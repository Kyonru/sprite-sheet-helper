// CLI-local copies of constants from src/ — keeps the CLI self-contained
// so tsc -p tsconfig.cli.json doesn't need to reach into src/.

export const WORKFLOW_PRESETS = [
  {
    id: "topdown-8dir",
    label: "Top Down 8-directional",
  },
  {
    id: "topdown-4dir",
    label: "Top Down 4-directional",
  },
  {
    id: "isometric",
    label: "Isometric",
  },
  {
    id: "platformer",
    label: "Platformer / Side View",
  },
  {
    id: "topdown-1dir",
    label: "Top Down Single Direction",
  },
  {
    id: "platformer-1dir",
    label: "Platformer Single Side",
  },
  {
    id: "front-back-2dir",
    label: "Front & Back - RPG Style",
  },
  {
    id: "three-quarter-4dir",
    label: "3/4 View 4-directional - Diablo Style",
  },
  {
    id: "three-quarter-8dir",
    label: "3/4 View 8-directional - Diablo Style",
  },
  {
    id: "isometric-1dir",
    label: "Isometric Single Direction",
  },
  {
    id: "front-facing",
    label: "Front-Facing - Doom Style",
  },
  {
    id: "profile-1dir",
    label: "Profile View Single",
  },
  {
    id: "diagonal-4dir",
    label: "Diagonal Only 4-direction",
  },
];

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
