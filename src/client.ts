/**
 * Typed client for the Kazidoc agent API (api.kazidoc.com).
 *
 * Multi-project: every filesystem method requires an explicit projectId
 * (p_...) as its first argument. Use getId(url) to resolve a pasted Kazidoc
 * drive URL to its project id, or listProjects() to enumerate accessible
 * projects. Results return the API's JSON verbatim — success payloads and
 * fail-closed error envelopes alike, so the model always sees
 * errorCode/message/requiredAction for recovery.
 */

export interface Env {
  KAZIDOC_API_KEY?: string;
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
}

export interface ProjectEntry {
  project_id: string;
  name: string;
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

export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "image/avif";

export type ReadImageResult =
  | {
      ok: true;
      mode: "image";
      path: string;
      mediaType: ImageMediaType;
      bytes: number;
      width?: number;
      height?: number;
      /** Presigned R2 GET URL — a bearer credential. Consume immediately; never save it into a document. */
      url: string;
      expiresInSeconds: number;
      expiresAt: string;
    }
  | FsError;
export type WriteImageResult =
  | { ok: true; path: string; created: boolean; mediaType: string; bytes: number; revision: string }
  | FsError;

const PROJECT_ID_PATTERN = /^p_[A-Za-z0-9]+$/;
const DRIVE_URL_PATTERN = /^\/drive\/(p_[A-Za-z0-9]+)(?:\/(.*))?$/;

export function createClient(env: Env) {
  const key = env.KAZIDOC_API_KEY;
  const base = (env.KAZIDOC_API_URL ?? "https://api.kazidoc.com").replace(/\/$/, "");
  if (!key) {
    throw new Error("Missing KAZIDOC_API_KEY. Run: kazibee kazidoc login <API_KEY>");
  }

  async function listProjects(): Promise<ProjectEntry[]> {
    const response = await fetch(`${base}/v1/projects`, {
      headers: { authorization: `Bearer ${key}` },
    });
    const body = (await response.json().catch(() => ({}))) as {
      projects?: ProjectEntry[];
      message?: string;
    };
    if (!response.ok || !Array.isArray(body.projects)) {
      throw new Error(
        `Kazidoc authentication failed (${response.status}): ${body.message ?? "invalid API key"}. ` +
          "Ask the user for a valid key: kazibee kazidoc login <API_KEY>",
      );
    }
    return body.projects;
  }

  /**
   * Resolve a pasted Kazidoc drive URL (or a bare p_... id) to a verified
   * project id this API key can access.
   *   https://kazidoc.com/drive/p_abc123XYZ456/notes/intro.md -> p_abc123XYZ456
   */
  async function getId(urlOrId: string): Promise<string> {
    let candidate: string;
    if (PROJECT_ID_PATTERN.test(urlOrId)) {
      candidate = urlOrId;
    } else if (/^https?:\/\//i.test(urlOrId)) {
      const url = new URL(urlOrId);
      const match = url.pathname.match(DRIVE_URL_PATTERN);
      if (!match) {
        throw new Error(`Not a Kazidoc project URL: ${urlOrId}. Expected .../drive/<project>/<path>`);
      }
      candidate = match[1];
    } else {
      throw new Error(
        `Cannot resolve a project id from "${urlOrId}". Pass a Kazidoc drive URL ` +
          "(https://kazidoc.com/drive/p_.../...) or a p_... project id.",
      );
    }
    const projects = await listProjects();
    const found = projects.find((p) => p.project_id === candidate);
    if (!found) {
      const options = projects.map((p) => `${p.name} (${p.project_id})`).join(", ") || "none";
      throw new Error(
        `This API key cannot access project ${candidate}. Accessible projects: ${options}.`,
      );
    }
    return found.project_id;
  }

  function requireProjectId(projectId: string): string {
    if (!PROJECT_ID_PATTERN.test(projectId)) {
      throw new Error(
        `Invalid projectId "${projectId}". Every call requires a p_... project id ` +
          "as its first argument. Resolve one from a URL with getId(url) or list " +
          "choices with listProjects().",
      );
    }
    return projectId;
  }

  /**
   * Accept plain project-relative paths OR pasted Kazidoc drive URLs, e.g.
   *   https://kazidoc.com/drive/p_abc123XYZ456/notes/intro.md
   * The /drive/<id> prefix is stripped; the explicitly supplied projectId is
   * authoritative and a mismatched URL fails fast — a pasted URL never
   * switches the target project.
   */
  function toPath(projectId: string, input: string): string {
    if (!/^https?:\/\//i.test(input)) return input;
    const url = new URL(input);
    const match = url.pathname.match(DRIVE_URL_PATTERN);
    if (!match) {
      throw new Error(`Not a Kazidoc project URL: ${input}. Expected .../drive/<project>/<path>`);
    }
    if (match[1] !== projectId) {
      throw new Error(
        `URL points at project ${match[1]}, but this call targets ${projectId}. ` +
          "Pass the matching projectId (resolve it with getId(url)).",
      );
    }
    return decodeURIComponent(match[2] ?? "");
  }

  function root(projectId: string): string {
    return `${base}/v1/projects/${requireProjectId(projectId)}`;
  }

  async function get(projectId: string, pathname: string, params: Record<string, string | number | undefined>): Promise<unknown> {
    const url = new URL(`${root(projectId)}/${pathname}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const response = await fetch(url, { headers: { authorization: `Bearer ${key}` } });
    return response.json();
  }

  async function post(projectId: string, pathname: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${root(projectId)}/${pathname}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  /** Raw-body POST for binary uploads (write_image). */
  async function postRaw(
    projectId: string,
    pathname: string,
    params: Record<string, string>,
    body: Uint8Array,
    contentType: string,
  ): Promise<unknown> {
    const url = new URL(`${root(projectId)}/${pathname}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": contentType },
      // Copy into a plain ArrayBuffer: satisfies BodyInit across TS lib targets.
      body: new Uint8Array(body).buffer as ArrayBuffer,
    });
    return response.json();
  }

  /**
   * Normalize writeImage input to Uint8Array.
   * Strings: a local filesystem path (starts with "/", "./", "../", or "~/")
   * is read from disk; a data: URL or bare base64 string is decoded.
   */
  async function toBytes(image: Blob | ArrayBuffer | Uint8Array | string): Promise<Uint8Array> {
    if (typeof image === "string") {
      if (/^(\/|\.\.?\/|~\/)/.test(image)) return readLocalFile(image);
      const binary = atob(image.replace(/^data:[^,]*,/, ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    if (image instanceof Uint8Array) return image;
    if (image instanceof ArrayBuffer) return new Uint8Array(image);
    return new Uint8Array(await image.arrayBuffer());
  }

  /** Read a local image file inside the sandbox's granted directories. */
  async function readLocalFile(path: string): Promise<Uint8Array> {
    const deno = (globalThis as { Deno?: { readFile(p: string): Promise<Uint8Array>; env?: { get(k: string): string | undefined } } }).Deno;
    if (!deno?.readFile) {
      throw new Error(`Cannot read local file "${path}": no filesystem access in this runtime. Pass bytes or base64 instead.`);
    }
    let resolved = path;
    if (path.startsWith("~/")) {
      const home = (() => { try { return deno.env?.get("HOME"); } catch { return undefined; } })();
      if (!home) throw new Error(`Cannot expand "~" in "${path}". Pass an absolute path.`);
      resolved = `${home}/${path.slice(2)}`;
    }
    try {
      return await deno.readFile(resolved);
    } catch (error) {
      throw new Error(
        `Cannot read local image "${resolved}": ${error instanceof Error ? error.message : String(error)}. ` +
          "The sandbox must be granted read access to this directory (allowWorkspace).",
      );
    }
  }

  return {
    /** List the projects this API key can access (project_id + name). */
    listProjects: (): Promise<ProjectEntry[]> => listProjects(),

    /** Resolve a pasted Kazidoc drive URL (or bare p_... id) to a verified, accessible project id. */
    getId: (urlOrId: string): Promise<string> => getId(urlOrId),

    /** List a directory in a project. Omit path (or pass "") for the project root. Accepts a pasted Kazidoc URL as path. */
    listdir: (projectId: string, path = ""): Promise<ListDirResult> =>
      get(projectId, "listdir", { path: toPath(projectId, path) }) as Promise<ListDirResult>,

    /** Regex search across a project's text files. include is a glob like "*.md". */
    grep: (projectId: string, pattern: string, path?: string, include?: string): Promise<GrepResult> =>
      get(projectId, "grep", { pattern, path: path ? toPath(projectId, path) : undefined, include }) as Promise<GrepResult>,

    /** Read a full file (line-numbered). Files over 1000 lines are denied — use grep + readRange. */
    read: (projectId: string, path: string): Promise<ReadResult> =>
      get(projectId, "read", { path: toPath(projectId, path) }) as Promise<ReadResult>,

    /** Read up to 1000 lines; endLine clamps to file length. Returns handleId for range edits. */
    readRange: (projectId: string, path: string, startLine: number, endLine: number): Promise<ReadRangeResult> =>
      get(projectId, "read_range", { path: toPath(projectId, path), startLine, endLine }) as Promise<ReadRangeResult>,

    /** Create or fully replace a text file. Ancestor folders are auto-created. */
    write: (projectId: string, path: string, content: string): Promise<WriteResult> =>
      post(projectId, "write", { path: toPath(projectId, path), content }) as Promise<WriteResult>,

    /** Replace one exact, unique text span. Ambiguous or missing targets are rejected. */
    editReplace: (projectId: string, path: string, textToReplace: string, newContent: string): Promise<EditResult> =>
      post(projectId, "edit_replace", { path: toPath(projectId, path), textToReplace, newContent }) as Promise<EditResult>,

    /** Insert content after one exact, unique anchor line. */
    editInsert: (projectId: string, path: string, line: string, content: string): Promise<EditResult> =>
      post(projectId, "edit_insert", { path: toPath(projectId, path), line, content }) as Promise<EditResult>,

    /** Delete one exact, unique line. */
    editDelete: (projectId: string, path: string, line: string): Promise<EditResult> =>
      post(projectId, "edit_delete", { path: toPath(projectId, path), line }) as Promise<EditResult>,

    /** Replace the exact span named by a readRange handleId. Empty string deletes the span. */
    rangeReplace: (projectId: string, id: string, newContent: string): Promise<EditResult> =>
      post(projectId, "range_replace", { id, newContent }) as Promise<EditResult>,

    /** Set the absolute indentation (spaces) of the span named by a handleId. */
    rangeIndent: (projectId: string, id: string, indent: number): Promise<EditResult> =>
      post(projectId, "range_indent", { id, indent }) as Promise<EditResult>,

    /**
     * Read a private image: returns metadata plus a presigned GET URL valid for
     * exactly 300 seconds. Consume the URL immediately (fetch/view it now);
     * never write it into a document — embed the relative path instead.
     */
    readImage: (projectId: string, path: string): Promise<ReadImageResult> =>
      get(projectId, "read_image", { path: toPath(projectId, path) }) as Promise<ReadImageResult>,

    /**
     * Upload an image (png/jpeg/webp/gif/avif, max 10 MiB) to an exact
     * project-relative path. Accepts raw bytes, a Blob, a base64 string, or a
     * local filesystem path ("/abs/…", "./rel/…", "~/…" — requires sandbox
     * read access to that directory). Ancestor folders are auto-created;
     * extension, mediaType, and actual bytes must agree.
     */
    writeImage: async (
      projectId: string,
      path: string,
      image: Blob | ArrayBuffer | Uint8Array | string,
      mediaType: ImageMediaType,
    ): Promise<WriteImageResult> =>
      postRaw(
        projectId,
        "write_image",
        { path: toPath(projectId, path) },
        await toBytes(image),
        mediaType,
      ) as Promise<WriteImageResult>,

    /** Create a directory (idempotent). A folder named like "pricing.csv" is a CSV workbook. */
    mkdir: (projectId: string, path: string): Promise<MkdirResult> =>
      post(projectId, "mkdir", { path: toPath(projectId, path) }) as Promise<MkdirResult>,

    /** Move or rename a file or an entire folder subtree. */
    move: (projectId: string, from: string, to: string): Promise<TransferResult> =>
      post(projectId, "move", { from: toPath(projectId, from), to: toPath(projectId, to) }) as Promise<TransferResult>,

    /** Copy a file or an entire folder subtree. */
    copy: (projectId: string, from: string, to: string): Promise<TransferResult> =>
      post(projectId, "copy", { from: toPath(projectId, from), to: toPath(projectId, to) }) as Promise<TransferResult>,

    /** Delete a file or an entire folder subtree. */
    delete: (projectId: string, path: string): Promise<DeleteResult> =>
      post(projectId, "delete", { path: toPath(projectId, path) }) as Promise<DeleteResult>,
  };
}

export type KazidocClient = ReturnType<typeof createClient>;
