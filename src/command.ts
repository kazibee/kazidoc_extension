/**
 * Setup commands for the kazidoc extension.
 *
 * login: validate the Kazidoc API key, confirm it can access at least one
 * project via GET /v1/projects, and return the values for the host to store
 * as tool env vars. A key may access many projects; the target project is
 * chosen per call (every client method takes a projectId), so nothing is
 * bound at login. Keys are created in the Kazidoc web app under
 * Settings -> API keys.
 */

export interface LoginResult {
  KAZIDOC_API_KEY?: string;
  KAZIDOC_API_URL?: string;
}

export async function login(env: Record<string, string>, ...args: string[]): Promise<LoginResult> {
  if (args.includes("--help")) {
    console.log([
      "Usage: kazibee kazidoc login <API_KEY> [API_URL]",
      "",
      "  API_KEY    A Kazidoc API key (kzd_...). Create one in the Kazidoc web app",
      "             under Settings -> API keys. It is shown exactly once.",
      "  API_URL    Optional override, e.g. http://localhost:6100 for local dev.",
      "             Defaults to https://api.kazidoc.com",
      "",
    ].join("\n"));
    return {};
  }

  const KAZIDOC_API_KEY = args[0] || env.KAZIDOC_API_KEY;
  const KAZIDOC_API_URL = args[1] || env.KAZIDOC_API_URL;

  if (!KAZIDOC_API_KEY || !KAZIDOC_API_KEY.startsWith("kzd_")) {
    throw new Error("Missing or invalid API key (must start with kzd_). Usage: kazibee kazidoc login <API_KEY>");
  }

  const base = (KAZIDOC_API_URL ?? "https://api.kazidoc.com").replace(/\/$/, "");
  const headers = { authorization: `Bearer ${KAZIDOC_API_KEY}` };

  // 1. Validate the credential itself.
  const who = await fetch(`${base}/v1/whoami`, { headers });
  if (!who.ok) {
    throw new Error(`Credential check failed (${who.status}). The key may be revoked or mistyped.`);
  }

  // 2. Confirm the key can access at least one project.
  const listResponse = await fetch(`${base}/v1/projects`, { headers });
  const body = (await listResponse.json().catch(() => ({}))) as {
    projects?: Array<{ project_id: string; name: string }>;
  };
  if (!listResponse.ok || !Array.isArray(body.projects)) {
    throw new Error(`Could not list accessible projects (${listResponse.status}).`);
  }
  const projects = body.projects;
  if (projects.length === 0) {
    throw new Error(
      "This key has no accessible projects. Grant it project access in the Kazidoc " +
        "web app under Settings -> API keys, then log in again.",
    );
  }

  const options = projects.map((p) => `  ${p.name}  ${p.project_id}`).join("\n");
  console.log(`kazidoc: key verified — ${projects.length} accessible project(s):\n${options}`);

  const result: LoginResult = { KAZIDOC_API_KEY };
  if (KAZIDOC_API_URL) result.KAZIDOC_API_URL = KAZIDOC_API_URL;
  return result;
}
