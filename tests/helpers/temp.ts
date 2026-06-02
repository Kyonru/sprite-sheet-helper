import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export async function createTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function removeTempDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
