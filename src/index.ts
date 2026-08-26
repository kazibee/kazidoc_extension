import { createClient, type Env } from "./client";

export type {
  Env,
  FsError,
  ImageMediaType,
  KazidocClient,
  ListDirEntry,
  ReadImageResult,
  WriteImageResult,
} from "./client";

export default function main(env: Env) {
  return createClient(env);
}
