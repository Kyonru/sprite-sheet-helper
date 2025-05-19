import type { FileType } from "@/types/file";

export const ACCEPTED_MODEL_FILE_TYPES: FileType[] = [
  "glb",
  "gltf",
  "obj",
  "fbx",
] as const;
