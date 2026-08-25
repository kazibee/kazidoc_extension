/**
 * Setup commands for the kazidoc extension.
 *
 * login: validate the Kazidoc API key and return it (plus optional API URL)
 * for the host to store as tool env vars. The key is project-scoped, so the
 * project is discovered from the key itself — no project id needed.
 * Keys are created in the Kazidoc web app under Settings -> API keys.
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
      "  API_KEY  A Kazidoc API key (kzd_...). Create one in the Kazidoc web app",
      "           under Settings -> API keys. It is shown exactly once.",
      "           The key is project-scoped; the project is detected automatically.",
      "  API_URL  Optional override, e.g. http://localhost:6100 for local dev.",
      "           Defaults to https://api.kazidoc.com",
      "",
    ].join("\n"));
    return {};
  }

  const KAZIDOC_API_KEY = args[0] || env.KAZIDOC_API_KEY;
  const KAZIDOC_API_URL = args[1] || env.KAZIDOC_API_URL;

  if (!KAZIDOC_API_KEY || !KAZIDOC_API_KEY.startsWith("kzd_")) {
    throw new Error("Missing or invalid API key (must start with kzd_). Usage: kazibee kazidoc login <API_KEY>");
  }

  // Verify the key and discover its project before declaring success.
  const base = (KAZIDOC_API_URL ?? "https://api.kazidoc.com").replace(/\/$/, "");
  const response = await fetch(`${base}/v1/whoami`, {
    headers: { authorization: `Bearer ${KAZIDOC_API_KEY}` },
  });
  const identity = (await response.json().catch(() => ({}))) as { project_id?: string };
  if (!response.ok || !identity.project_id) {
    throw new Error(`Credential check failed (${response.status}). The key may be revoked or mistyped.`);
  }
  console.log(`kazidoc: key verified — project ${identity.project_id}.`);

  const result: LoginResult = { KAZIDOC_API_KEY };
  if (KAZIDOC_API_URL) result.KAZIDOC_API_URL = KAZIDOC_API_URL;
  return result;
}
