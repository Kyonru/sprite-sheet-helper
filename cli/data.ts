// CLI-local copies of constants from src/ — keeps the CLI self-contained
// so tsc -p tsconfig.cli.json doesn't need to reach into src/.

export const WORKFLOW_PRESETS = [
  { id: "topdown-8dir", label: "Top Down 8-directional" },
  { id: "topdown-4dir", label: "Top Down 4-directional" },
  { id: "isometric", label: "Isometric" },
  { id: "platformer", label: "Platformer / Side View" },
] as const;

export const EXPORT_FORMATS = [
  "zip",
  "spritesheet",
  "gif",
  "love2d-lua",
  "love2d-anim8",
  "turbo",
  "bevy",
  "phaser",
  "godot",
  "pygame",
  "raylib",
  "unity",
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const ACCEPTED_MODEL_FILE_TYPES = ["glb", "gltf", "obj", "fbx"] as const;
