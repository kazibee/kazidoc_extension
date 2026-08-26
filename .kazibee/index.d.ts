/**
 * Typed client for the Kazidoc agent API (api.kazidoc.com).
 *
 * Every method targets one project (from env) and returns the API's JSON
 * verbatim — success payloads and fail-closed error envelopes alike, so the
 * model always sees errorCode/message/requiredAction for recovery.
 */
export interface Env {
	KAZIDOC_API_KEY?: string;
	/** Override for local development, e.g. http://localhost:6005 */
	KAZIDOC_API_URL?: string;
	/**
	 * The project this workspace is bound to (p_...). Keys may access many
	 * projects; when unset, the single accessible project is auto-selected and
	 * multiple projects raise an error listing the choices.
	 */
	KAZIDOC_PROJECT_ID?: string;
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
declare function createClient(env: Env): {
	/** List the projects this API key can access (project_id + name). */
	listProjects: () => Promise<Array<{
		project_id: string;
		name: string;
	}>>;
	/** List a directory. Omit path (or pass "") for the project root. Accepts a pasted Kazidoc URL. */
	listdir: (path?: string) => Promise<ListDirResult>;
	/** Regex search across the project's text files. include is a glob like "*.md". */
	grep: (pattern: string, path?: string, include?: string) => Promise<GrepResult>;
	/** Read a full file (line-numbered). Files over 1000 lines are denied — use grep + readRange. */
	read: (path: string) => Promise<ReadResult>;
	/** Read up to 1000 lines; endLine clamps to file length. Returns handleId for range edits. */
	readRange: (path: string, startLine: number, endLine: number) => Promise<ReadRangeResult>;
	/** Create or fully replace a text file. Ancestor folders are auto-created. */
	write: (path: string, content: string) => Promise<WriteResult>;
	/** Replace one exact, unique text span. Ambiguous or missing targets are rejected. */
	editReplace: (path: string, textToReplace: string, newContent: string) => Promise<EditResult>;
	/** Insert content after one exact, unique anchor line. */
	editInsert: (path: string, line: string, content: string) => Promise<EditResult>;
	/** Delete one exact, unique line. */
	editDelete: (path: string, line: string) => Promise<EditResult>;
	/** Replace the exact span named by a readRange handleId. Empty string deletes the span. */
	rangeReplace: (id: string, newContent: string) => Promise<EditResult>;
	/** Set the absolute indentation (spaces) of the span named by a handleId. */
	rangeIndent: (id: string, indent: number) => Promise<EditResult>;
	/** Create a directory (idempotent). A folder named like "pricing.csv" is a CSV workbook. */
	mkdir: (path: string) => Promise<MkdirResult>;
	/** Move or rename a file or an entire folder subtree. */
	move: (from: string, to: string) => Promise<TransferResult>;
	/** Copy a file or an entire folder subtree. */
	copy: (from: string, to: string) => Promise<TransferResult>;
	/** Delete a file or an entire folder subtree. */
	delete: (path: string) => Promise<DeleteResult>;
};
export type KazidocClient = ReturnType<typeof createClient>;
declare function main(env: Env): {
	listProjects: () => Promise<Array<{
		project_id: string;
		name: string;
	}>>;
	listdir: (path?: string) => Promise<ListDirResult>;
	grep: (pattern: string, path?: string, include?: string) => Promise<GrepResult>;
	read: (path: string) => Promise<ReadResult>;
	readRange: (path: string, startLine: number, endLine: number) => Promise<ReadRangeResult>;
	write: (path: string, content: string) => Promise<WriteResult>;
	editReplace: (path: string, textToReplace: string, newContent: string) => Promise<EditResult>;
	editInsert: (path: string, line: string, content: string) => Promise<EditResult>;
	editDelete: (path: string, line: string) => Promise<EditResult>;
	rangeReplace: (id: string, newContent: string) => Promise<EditResult>;
	rangeIndent: (id: string, indent: number) => Promise<EditResult>;
	mkdir: (path: string) => Promise<MkdirResult>;
	move: (from: string, to: string) => Promise<TransferResult>;
	copy: (from: string, to: string) => Promise<TransferResult>;
	delete: (path: string) => Promise<DeleteResult>;
};

export {
	main as default,
};

export {};
