/**
 * Typed client for the Kazidoc agent API (api.kazidoc.com).
 *
 * Every method targets one project (from env) and returns the API's JSON
 * verbatim — success payloads and fail-closed error envelopes alike, so the
 * model always sees errorCode/message/requiredAction for recovery.
 */

export interface Env {
  KAZIDOC_API_KEY?: string;
  KAZIDOC_PROJECT_ID?: string;
  /** Override for local development, e.g. http://localhost:6005 */
  KAZIDOC_API_URL?: string;
}

export interface FsError {
  ok: false;
  error: true;
  recoverable: boolean;
  errorCode: string;
  message: string;
  requiredAction: string;
  totalLines?: number;
}

export interface ListDirEntry {
  name: string;
  path: string;
  kind: "file" | "dir";
  size_bytes: number;
  line_count: number;
  updated_at: string;
}

export type ListDirResult = { ok: true; path: string; entries: ListDirEntry[] } | FsError;
export type ReadResult = { ok: true; mode: "full"; content: string; lines: number; path: string } | FsError;
export type ReadRangeResult =
  | { ok: true; mode: "range"; content: string; path: string; startLine: number; endLine: number; totalLines: number; handleId: string }
  | FsError;
export type GrepResult =
  | { ok: true; files: Array<{ path: string; matchCount: number; lines: number[]; samples: Array<{ line_number: number; line_content: string }> }>; matchCount: number; fileCount: number; truncated: boolean }
  | FsError;
export type WriteResult = { ok: true; path: string; created: boolean; lines: number } | FsError;
export type EditResult = { ok: true; path: string; lines: number } | FsError;
export type MkdirResult = { ok: true; path: string } | FsError;
export type TransferResult = { ok: true; from: string; to: string; moved: number } | FsError;
export type DeleteResult = { ok: true; path: string; deleted: number } | FsError;

export function createClient(env: Env) {
  const key = env.KAZIDOC_API_KEY;
  const projectId = env.KAZIDOC_PROJECT_ID;
  const base = (env.KAZIDOC_API_URL ?? "https://api.kazidoc.com").replace(/\/$/, "");
  if (!key || !projectId) {
    throw new Error(
      "Missing KAZIDOC_API_KEY or KAZIDOC_PROJECT_ID. Run: kazibee kazidoc login <API_KEY> <PROJECT_ID>",
    );
  }
  const root = `${base}/v1/projects/${projectId}`;

  async function get(pathname: string, params: Record<string, string | number | undefined>): Promise<unknown> {
    const url = new URL(`${root}/${pathname}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const response = await fetch(url, { headers: { authorization: `Bearer ${key}` } });
    return response.json();
  }

  async function post(pathname: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${root}/${pathname}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  return {
    /** List a directory. Omit path (or pass "") for the project root. */
    listdir: (path = ""): Promise<ListDirResult> => get("listdir", { path }) as Promise<ListDirResult>,

    /** Regex search across the project's text files. include is a glob like "*.md". */
    grep: (pattern: string, path?: string, include?: string): Promise<GrepResult> =>
      get("grep", { pattern, path, include }) as Promise<GrepResult>,

    /** Read a full file (line-numbered). Files over 1000 lines are denied — use grep + readRange. */
    read: (path: string): Promise<ReadResult> => get("read", { path }) as Promise<ReadResult>,

    /** Read up to 1000 lines; endLine clamps to file length. Returns handleId for range edits. */
    readRange: (path: string, startLine: number, endLine: number): Promise<ReadRangeResult> =>
      get("read_range", { path, startLine, endLine }) as Promise<ReadRangeResult>,

    /** Create or fully replace a text file. Ancestor folders are auto-created. */
    write: (path: string, content: string): Promise<WriteResult> =>
      post("write", { path, content }) as Promise<WriteResult>,

    /** Replace one exact, unique text span. Ambiguous or missing targets are rejected. */
    editReplace: (path: string, textToReplace: string, newContent: string): Promise<EditResult> =>
      post("edit_replace", { path, textToReplace, newContent }) as Promise<EditResult>,

    /** Insert content after one exact, unique anchor line. */
    editInsert: (path: string, line: string, content: string): Promise<EditResult> =>
      post("edit_insert", { path, line, content }) as Promise<EditResult>,

    /** Delete one exact, unique line. */
    editDelete: (path: string, line: string): Promise<EditResult> =>
      post("edit_delete", { path, line }) as Promise<EditResult>,

    /** Replace the exact span named by a readRange handleId. Empty string deletes the span. */
    rangeReplace: (id: string, newContent: string): Promise<EditResult> =>
      post("range_replace", { id, newContent }) as Promise<EditResult>,

    /** Set the absolute indentation (spaces) of the span named by a handleId. */
    rangeIndent: (id: string, indent: number): Promise<EditResult> =>
      post("range_indent", { id, indent }) as Promise<EditResult>,

    /** Create a directory (idempotent). A folder named like "pricing.csv" is a CSV workbook. */
    mkdir: (path: string): Promise<MkdirResult> => post("mkdir", { path }) as Promise<MkdirResult>,

    /** Move or rename a file or an entire folder subtree. */
    move: (from: string, to: string): Promise<TransferResult> =>
      post("move", { from, to }) as Promise<TransferResult>,

    /** Copy a file or an entire folder subtree. */
    copy: (from: string, to: string): Promise<TransferResult> =>
      post("copy", { from, to }) as Promise<TransferResult>,

    /** Delete a file or an entire folder subtree. */
    delete: (path: string): Promise<DeleteResult> => post("delete", { path }) as Promise<DeleteResult>,
  };
}

export type KazidocClient = ReturnType<typeof createClient>;
