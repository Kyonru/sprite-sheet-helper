export type FileType = "glb" | "gltf" | "obj" | "fbx";
export const ExportFormats = [
  "zip",
  "spritesheet",
  "gif",
  "lua",
  "turbo-rust",
  "phaser",
  "godot",
  "pygame",
  "raylib",
  "unity",
] as const;
export type ExportFormat = (typeof ExportFormats)[number];
