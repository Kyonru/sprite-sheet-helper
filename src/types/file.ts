export type FileType = "glb" | "gltf" | "obj" | "fbx";
export const ExportFormats = [
  "zip",
  "spritesheet",
  "gif",
  "love2d-lua",
  "love2d-anim8",
  "turbo-rust",
  "phaser",
  "godot",
  "pygame",
  "raylib",
  "unity",
] as const;
export type ExportFormat = (typeof ExportFormats)[number];
