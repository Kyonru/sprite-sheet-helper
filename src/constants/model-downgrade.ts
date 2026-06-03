import type {
  ModelDowngradePreset,
  ModelDowngradePresetId,
  ModelDowngradeRecipe,
} from "@/types/model-downgrade";

export const DEFAULT_MODEL_DOWNGRADE_RECIPE: ModelDowngradeRecipe = {
  presetId: "ps1-character",
  triangleBudget: 800,
  textureSize: 128,
  paletteColors: 32,
  flatShading: true,
  snapVertices: 0.025,
  animationFps: 10,
  steppedAnimation: true,
  nearestFiltering: true,
  simplifyMaterials: true,
  mergeVertices: true,
  removeTinyIslands: true,
  ditherTextures: true,
};

export const MODEL_DOWNGRADE_PRESETS: Record<
  ModelDowngradePresetId,
  ModelDowngradePreset
> = {
  "ps1-character": {
    id: "ps1-character",
    name: "PS1 Character",
    description:
      "Low triangle target, snapped vertices, low-res dithered textures, flat materials, and stepped animation.",
    recipe: DEFAULT_MODEL_DOWNGRADE_RECIPE,
  },
  "low-poly-clean": {
    id: "low-poly-clean",
    name: "Low Poly Clean",
    description:
      "Moderate triangle target, flat normals, clean simplified materials, and readable texture limits.",
    recipe: {
      ...DEFAULT_MODEL_DOWNGRADE_RECIPE,
      presetId: "low-poly-clean",
      triangleBudget: 1500,
      textureSize: 256,
      paletteColors: 48,
      snapVertices: 0,
      animationFps: 12,
      steppedAnimation: false,
      nearestFiltering: false,
      ditherTextures: false,
    },
  },
  "pixel-art-3d": {
    id: "pixel-art-3d",
    name: "Pixel Art 3D",
    description:
      "Very small texture target, hard edges, nearest filtering, and aggressively stepped motion.",
    recipe: {
      ...DEFAULT_MODEL_DOWNGRADE_RECIPE,
      presetId: "pixel-art-3d",
      triangleBudget: 1200,
      textureSize: 64,
      paletteColors: 16,
      snapVertices: 0.0125,
      animationFps: 8,
      simplifyMaterials: true,
      removeTinyIslands: false,
      ditherTextures: false,
    },
  },
  "retro-horror": {
    id: "retro-horror",
    name: "Retro Horror",
    description:
      "PS1-style mesh and texture limits with darker material simplification and heavier dither.",
    recipe: {
      ...DEFAULT_MODEL_DOWNGRADE_RECIPE,
      presetId: "retro-horror",
      triangleBudget: 700,
      textureSize: 128,
      paletteColors: 24,
      snapVertices: 0.035,
      animationFps: 10,
      ditherTextures: true,
    },
  },
};

export const MODEL_DOWNGRADE_PRESET_LIST = Object.values(
  MODEL_DOWNGRADE_PRESETS,
);
