import type { CameraType } from "@/types/camera";
import type { EffectComponent, EffectType } from "@/types/effects";
import type {
  MaterialAsset,
  MaterialPresetId,
} from "@/types/materials";

export type StylePresetId =
  | "ps1-character"
  | "low-poly-clean"
  | "pixel-art-3d"
  | "retro-horror";

export type StylePresetTarget = {
  triangleBudget?: number;
  textureSize: number;
  paletteColors: number;
  flatShading: boolean;
  snapVertices?: number;
  animationFps: number;
  nearestFiltering: boolean;
  dither: boolean;
  affineTexture?: boolean;
  vertexLighting?: "harsh" | "soft" | "none";
  bakedAo?: boolean;
  orthographic?: boolean;
  lowDrawDistance?: number;
};

export type StylePresetEffect = {
  type: EffectType;
  props?: Partial<EffectComponent>;
};

export type StylePresetRenderDefaults = {
  width?: number;
  height?: number;
  exportWidth?: number;
  exportHeight?: number;
  cameraType?: CameraType;
  cameraDistance?: number;
};

export type StylePresetDefinition = {
  id: StylePresetId;
  name: string;
  description: string;
  materialPresetId: MaterialPresetId;
  materialValues: Partial<MaterialAsset>;
  targets: StylePresetTarget;
  renderDefaults: StylePresetRenderDefaults;
  effects: StylePresetEffect[];
  pipelineNotes: string[];
};
