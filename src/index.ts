import { createClient, type Env } from "./client";

export type { Env, FsError, KazidocClient, ListDirEntry } from "./client";

export default function main(env: Env) {
  return createClient(env);
}
