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
export type ListDirResult = {
	ok: true;
	path: string;
	entries: ListDirEntry[];
} | FsError;
export type ReadResult = {
	ok: true;
	mode: "full";
	content: string;
	lines: number;
	path: string;
} | FsError;
export type ReadRangeResult = {
	ok: true;
	mode: "range";
	content: string;
	path: string;
	startLine: number;
	endLine: number;
	totalLines: number;
	handleId: string;
} | FsError;
export type GrepResult = {
	ok: true;
	files: Array<{
		path: string;
		matchCount: number;
		lines: number[];
		samples: Array<{
			line_number: number;
			line_content: string;
		}>;
	}>;
	matchCount: number;
	fileCount: number;
	truncated: boolean;
} | FsError;
export type WriteResult = {
	ok: true;
	path: string;
	created: boolean;
	lines: number;
} | FsError;
export type EditResult = {
	ok: true;
	path: string;
	lines: number;
} | FsError;
export type MkdirResult = {
	ok: true;
	path: string;
} | FsError;
export type TransferResult = {
	ok: true;
	from: string;
	to: string;
	moved: number;
} | FsError;
export type DeleteResult = {
	ok: true;
	path: string;
	deleted: number;
} | FsError;
export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "image/avif";
export type ReadImageResult = {
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
} | FsError;
export type WriteImageResult = {
	ok: true;
	path: string;
	created: boolean;
	mediaType: string;
	bytes: number;
	revision: string;
} | FsError;
declare function createClient(env: Env): {
	/** List the projects this API key can access (project_id + name). */
	listProjects: () => Promise<ProjectEntry[]>;
	/** Resolve a pasted Kazidoc drive URL (or bare p_... id) to a verified, accessible project id. */
	getId: (urlOrId: string) => Promise<string>;
	/** List a directory in a project. Omit path (or pass "") for the project root. Accepts a pasted Kazidoc URL as path. */
	listdir: (projectId: string, path?: string) => Promise<ListDirResult>;
	/** Regex search across a project's text files. include is a glob like "*.md". */
	grep: (projectId: string, pattern: string, path?: string, include?: string) => Promise<GrepResult>;
	/** Read a full file (line-numbered). Files over 1000 lines are denied — use grep + readRange. */
	read: (projectId: string, path: string) => Promise<ReadResult>;
	/** Read up to 1000 lines; endLine clamps to file length. Returns handleId for range edits. */
	readRange: (projectId: string, path: string, startLine: number, endLine: number) => Promise<ReadRangeResult>;
	/** Create or fully replace a text file. Ancestor folders are auto-created. */
	write: (projectId: string, path: string, content: string) => Promise<WriteResult>;
	/** Replace one exact, unique text span. Ambiguous or missing targets are rejected. */
	editReplace: (projectId: string, path: string, textToReplace: string, newContent: string) => Promise<EditResult>;
	/** Insert content after one exact, unique anchor line. */
	editInsert: (projectId: string, path: string, line: string, content: string) => Promise<EditResult>;
	/** Delete one exact, unique line. */
	editDelete: (projectId: string, path: string, line: string) => Promise<EditResult>;
	/** Replace the exact span named by a readRange handleId. Empty string deletes the span. */
	rangeReplace: (projectId: string, id: string, newContent: string) => Promise<EditResult>;
	/** Set the absolute indentation (spaces) of the span named by a handleId. */
	rangeIndent: (projectId: string, id: string, indent: number) => Promise<EditResult>;
	/**
	 * Read a private image: returns metadata plus a presigned GET URL valid for
	 * exactly 300 seconds. Consume the URL immediately (fetch/view it now);
	 * never write it into a document — embed the relative path instead.
	 */
	readImage: (projectId: string, path: string) => Promise<ReadImageResult>;
	/**
	 * Upload an image (png/jpeg/webp/gif/avif, max 10 MiB) to an exact
	 * project-relative path. Accepts raw bytes, a Blob, a base64 string, or a
	 * local filesystem path ("/abs/…", "./rel/…", "~/…" — requires sandbox
	 * read access to that directory). Ancestor folders are auto-created;
	 * extension, mediaType, and actual bytes must agree.
	 */
	writeImage: (projectId: string, path: string, image: Blob | ArrayBuffer | Uint8Array | string, mediaType: ImageMediaType) => Promise<WriteImageResult>;
	/** Create a directory (idempotent). A folder named like "pricing.csv" is a CSV workbook. */
	mkdir: (projectId: string, path: string) => Promise<MkdirResult>;
	/** Move or rename a file or an entire folder subtree. */
	move: (projectId: string, from: string, to: string) => Promise<TransferResult>;
	/** Copy a file or an entire folder subtree. */
	copy: (projectId: string, from: string, to: string) => Promise<TransferResult>;
	/** Delete a file or an entire folder subtree. */
	delete: (projectId: string, path: string) => Promise<DeleteResult>;
};
export type KazidocClient = ReturnType<typeof createClient>;
declare function main(env: Env): {
	listProjects: () => Promise<ProjectEntry[]>;
	getId: (urlOrId: string) => Promise<string>;
	listdir: (projectId: string, path?: string) => Promise<ListDirResult>;
	grep: (projectId: string, pattern: string, path?: string, include?: string) => Promise<GrepResult>;
	read: (projectId: string, path: string) => Promise<ReadResult>;
	readRange: (projectId: string, path: string, startLine: number, endLine: number) => Promise<ReadRangeResult>;
	write: (projectId: string, path: string, content: string) => Promise<WriteResult>;
	editReplace: (projectId: string, path: string, textToReplace: string, newContent: string) => Promise<EditResult>;
	editInsert: (projectId: string, path: string, line: string, content: string) => Promise<EditResult>;
	editDelete: (projectId: string, path: string, line: string) => Promise<EditResult>;
	rangeReplace: (projectId: string, id: string, newContent: string) => Promise<EditResult>;
	rangeIndent: (projectId: string, id: string, indent: number) => Promise<EditResult>;
	readImage: (projectId: string, path: string) => Promise<ReadImageResult>;
	writeImage: (projectId: string, path: string, image: Blob | ArrayBuffer | Uint8Array | string, mediaType: ImageMediaType) => Promise<WriteImageResult>;
	mkdir: (projectId: string, path: string) => Promise<MkdirResult>;
	move: (projectId: string, from: string, to: string) => Promise<TransferResult>;
	copy: (projectId: string, from: string, to: string) => Promise<TransferResult>;
	delete: (projectId: string, path: string) => Promise<DeleteResult>;
};

export {
	main as default,
};

export {};
