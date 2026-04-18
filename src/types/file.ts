export type FileType = "glb" | "gltf" | "obj" | "fbx";
export const ExportFormats = [
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
export type ExportFormat = (typeof ExportFormats)[number];

export interface ExportRow {
  uuid: string;
  label: string;
  images: string[];
  frameWidth: number;
  frameHeight: number;
  fps: number;
}

export type ExportContext = {
  exportedImages: ExportRow[];
  frameDelay: number;
};

export type ExportFile = {
  name: string;
  content: string | ArrayBuffer;
  base64?: boolean;
};

export type ExportResult = {
  files: ExportFile[];
  filename: string;
};

export type Exporter<T extends ExportFormat> = {
  id: T;
  label: string;
  run: (ctx: ExportContext) => Promise<ExportResult>;
};
