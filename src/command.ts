/**
 * Setup commands for the kazidoc extension.
 *
 * login: validate the Kazidoc API key, discover which projects it can access
 * via GET /v1/projects, bind one project to this workspace, and return the
 * values for the host to store as tool env vars. A key may access many
 * projects; the same key can be bound to different projects in different
 * workspaces. Keys are created in the Kazidoc web app under Settings -> API keys.
 */

export interface LoginResult {
  KAZIDOC_API_KEY?: string;
  KAZIDOC_API_URL?: string;
  KAZIDOC_PROJECT_ID?: string;
}

export async function login(env: Record<string, string>, ...args: string[]): Promise<LoginResult> {
  if (args.includes("--help")) {
    console.log([
      "Usage: kazibee kazidoc login <API_KEY> [API_URL] [--project <projectId>]",
      "",
      "  API_KEY    A Kazidoc API key (kzd_...). Create one in the Kazidoc web app",
      "             under Settings -> API keys. It is shown exactly once.",
      "  API_URL    Optional override, e.g. http://localhost:6100 for local dev.",
      "             Defaults to https://api.kazidoc.com",
      "  --project  The project (p_...) to bind this workspace to. Required when",
      "             the key can access more than one project; auto-selected when",
      "             it can access exactly one.",
      "",
    ].join("\n"));
    return {};
  }

  const projectFlag = args.indexOf("--project");
  const requestedProject = projectFlag !== -1 ? args[projectFlag + 1] : undefined;
  const positional = args.filter((a, i) => a !== "--project" && i !== projectFlag + 1);

  const KAZIDOC_API_KEY = positional[0] || env.KAZIDOC_API_KEY;
  const KAZIDOC_API_URL = positional[1] || env.KAZIDOC_API_URL;

  if (!KAZIDOC_API_KEY || !KAZIDOC_API_KEY.startsWith("kzd_")) {
    throw new Error("Missing or invalid API key (must start with kzd_). Usage: kazibee kazidoc login <API_KEY>");
  }
  if (projectFlag !== -1 && (!requestedProject || !requestedProject.startsWith("p_"))) {
    throw new Error("--project requires a project id like p_AbCdEf123456");
  }

  const base = (KAZIDOC_API_URL ?? "https://api.kazidoc.com").replace(/\/$/, "");
  const headers = { authorization: `Bearer ${KAZIDOC_API_KEY}` };

  // 1. Validate the credential itself.
  const who = await fetch(`${base}/v1/whoami`, { headers });
  if (!who.ok) {
    throw new Error(`Credential check failed (${who.status}). The key may be revoked or mistyped.`);
  }

  // 2. Discover which projects this key can access.
  const listResponse = await fetch(`${base}/v1/projects`, { headers });
  const body = (await listResponse.json().catch(() => ({}))) as {
    projects?: Array<{ project_id: string; name: string }>;
  };
  if (!listResponse.ok || !Array.isArray(body.projects)) {
    throw new Error(`Could not list accessible projects (${listResponse.status}).`);
  }
  const projects = body.projects;

  // 3. Bind exactly one project to this workspace.
  let KAZIDOC_PROJECT_ID: string;
  if (requestedProject) {
    if (!projects.some((p) => p.project_id === requestedProject)) {
      const options = projects.map((p) => `  ${p.name}  ${p.project_id}`).join("\n");
      throw new Error(
        `This key cannot access ${requestedProject}. Accessible projects:\n${options || "  (none)"}`,
      );
    }
    KAZIDOC_PROJECT_ID = requestedProject;
  } else if (projects.length === 0) {
    throw new Error(
      "This key has no accessible projects. Grant it project access in the Kazidoc " +
        "web app under Settings -> API keys, then log in again.",
    );
  } else if (projects.length === 1) {
    KAZIDOC_PROJECT_ID = projects[0].project_id;
  } else {
    const options = projects.map((p) => `  ${p.name}  ${p.project_id}`).join("\n");
    throw new Error(
      `This key can access ${projects.length} projects — choose one with --project:\n${options}\n` +
        "Usage: kazibee kazidoc login <API_KEY> --project <projectId>",
    );
  }

  const bound = projects.find((p) => p.project_id === KAZIDOC_PROJECT_ID);
  console.log(`kazidoc: key verified — bound to ${bound?.name ?? KAZIDOC_PROJECT_ID} (${KAZIDOC_PROJECT_ID}).`);

  const result: LoginResult = { KAZIDOC_API_KEY, KAZIDOC_PROJECT_ID };
  if (KAZIDOC_API_URL) result.KAZIDOC_API_URL = KAZIDOC_API_URL;
  return result;
}
