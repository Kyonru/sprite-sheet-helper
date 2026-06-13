import type { SpritePostprocessSnapshot } from "./sprite-postprocess";

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

export type AtlasLayout = "rows" | "packed";

export interface AtlasOptions {
  layout: AtlasLayout;
  padding: number;
  extrude: number;
  scale: number;
  maxAtlasSize: number;
  allowMultiPage: boolean;
}

export interface ExportRow {
  uuid: string;
  label: string;
  images: string[];
  normalImages?: string[];
  frameWidth: number;
  frameHeight: number;
  fps: number;
}

export type ExportContext = {
  exportedImages: ExportRow[];
  frameDelay: number;
  includeNormalMap: boolean;
  atlasOptions?: Partial<AtlasOptions>;
  spritePostprocess?: SpritePostprocessSnapshot;
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
