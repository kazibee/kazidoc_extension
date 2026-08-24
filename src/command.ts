/**
 * Setup commands for the kazidoc extension.
 *
 * login: validate and return the Kazidoc API key, project id, and optional
 * API URL. The returned values are stored as tool env vars by the host.
 * Keys are created in the Kazidoc web app under Settings -> API keys.
 */

export interface LoginResult {
  KAZIDOC_API_KEY?: string;
  KAZIDOC_PROJECT_ID?: string;
  KAZIDOC_API_URL?: string;
}

export async function login(env: Record<string, string>, ...args: string[]): Promise<LoginResult> {
  if (args.includes("--help")) {
    console.log([
      "Usage: kazibee kazidoc login <API_KEY> <PROJECT_ID> [API_URL]",
      "",
      "  API_KEY     A Kazidoc API key (kzd_...). Create one in the Kazidoc web app",
      "              under Settings -> API keys. It is shown exactly once.",
      "  PROJECT_ID  The project the key belongs to (p_...).",
      "  API_URL     Optional override, e.g. http://localhost:6005 for local dev.",
      "              Defaults to https://api.kazidoc.com",
      "",
    ].join("\n"));
    return {};
  }

  const KAZIDOC_API_KEY = args[0] || env.KAZIDOC_API_KEY;
  const KAZIDOC_PROJECT_ID = args[1] || env.KAZIDOC_PROJECT_ID;
  const KAZIDOC_API_URL = args[2] || env.KAZIDOC_API_URL;

  if (!KAZIDOC_API_KEY || !KAZIDOC_API_KEY.startsWith("kzd_")) {
    throw new Error("Missing or invalid API key (must start with kzd_). Usage: kazibee kazidoc login <API_KEY> <PROJECT_ID>");
  }
  if (!KAZIDOC_PROJECT_ID || !KAZIDOC_PROJECT_ID.startsWith("p_")) {
    throw new Error("Missing or invalid project id (must start with p_). Usage: kazibee kazidoc login <API_KEY> <PROJECT_ID>");
  }

  // Verify the credentials against the live API before declaring success.
  const base = (KAZIDOC_API_URL ?? "https://api.kazidoc.com").replace(/\/$/, "");
  const response = await fetch(`${base}/v1/projects/${KAZIDOC_PROJECT_ID}/listdir`, {
    headers: { authorization: `Bearer ${KAZIDOC_API_KEY}` },
  });
  if (!response.ok) {
    throw new Error(`Credential check failed (${response.status}). The key may be revoked or belong to a different project.`);
  }
  console.log(`kazidoc: credentials verified for project ${KAZIDOC_PROJECT_ID}.`);

  const result: LoginResult = { KAZIDOC_API_KEY, KAZIDOC_PROJECT_ID };
  if (KAZIDOC_API_URL) result.KAZIDOC_API_URL = KAZIDOC_API_URL;
  return result;
}
