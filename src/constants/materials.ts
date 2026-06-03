import type {
  MaterialAsset,
  MaterialPresetId,
  RetroTextureOptions,
} from "@/types/materials";

export const DEFAULT_RETRO_TEXTURE_OPTIONS: RetroTextureOptions = {
  targetSize: 128,
  paletteColors: 32,
  dither: true,
  nearest: true,
};

export const DEFAULT_MATERIAL_VALUES: Omit<
  MaterialAsset,
  "uuid" | "name" | "createdAt" | "updatedAt"
> = {
  color: "#ffffff",
  opacity: 1,
  transparent: false,
  roughness: 0.5,
  metalness: 0,
  emissive: "#000000",
  emissiveIntensity: 0,
  wireframe: false,
  side: "front",
  depthWrite: true,
  flatShading: false,
  lightingMode: "pbr",
  textureRefs: {},
  nearestFiltering: false,
  textureSize: 512,
  paletteColors: 64,
  dithering: false,
};

export type MaterialPresetDefinition = {
  id: MaterialPresetId;
  name: string;
  description: string;
  values: Partial<MaterialAsset>;
};

export const MATERIAL_PRESETS: Record<
  MaterialPresetId,
  MaterialPresetDefinition
> = {
  "standard-pbr": {
    id: "standard-pbr",
    name: "Standard PBR",
    description: "Balanced physically based material for imported assets.",
    values: {
      color: "#ffffff",
      roughness: 0.5,
      metalness: 0,
      lightingMode: "pbr",
      flatShading: false,
      nearestFiltering: false,
      textureSize: 512,
      paletteColors: 64,
      dithering: false,
    },
  },
  "unlit-sprite": {
    id: "unlit-sprite",
    name: "Unlit Sprite",
    description: "Color-only material that ignores scene lighting.",
    values: {
      color: "#ffffff",
      roughness: 1,
      metalness: 0,
      lightingMode: "unlit",
      flatShading: false,
      nearestFiltering: true,
    },
  },
  "low-poly-flat": {
    id: "low-poly-flat",
    name: "Low Poly Flat",
    description: "Flat-shaded matte material for clean low-poly silhouettes.",
    values: {
      color: "#d7c29b",
      roughness: 0.85,
      metalness: 0,
      lightingMode: "flat",
      flatShading: true,
      nearestFiltering: true,
      textureSize: 256,
      paletteColors: 48,
      dithering: false,
    },
  },
  "ps1-character": {
    id: "ps1-character",
    name: "PS1 Character",
    description: "Low-res, palette-limited, nearest-filtered retro surface.",
    values: {
      color: "#d9c3a0",
      roughness: 1,
      metalness: 0,
      lightingMode: "flat",
      flatShading: true,
      nearestFiltering: true,
      textureSize: 128,
      paletteColors: 32,
      dithering: true,
    },
  },
  "retro-horror": {
    id: "retro-horror",
    name: "Retro Horror",
    description: "Dark, rough, palette-limited material for moody captures.",
    values: {
      color: "#8f7d72",
      roughness: 1,
      metalness: 0,
      emissive: "#090606",
      emissiveIntensity: 0.1,
      lightingMode: "flat",
      flatShading: true,
      nearestFiltering: true,
      textureSize: 128,
      paletteColors: 24,
      dithering: true,
    },
  },
  toon: {
    id: "toon",
    name: "Toon",
    description: "Clean bright material for stylized outline-friendly sprites.",
    values: {
      color: "#f5d37b",
      roughness: 0.7,
      metalness: 0,
      lightingMode: "pbr",
      flatShading: false,
      nearestFiltering: false,
      textureSize: 512,
      paletteColors: 64,
      dithering: false,
    },
  },
};
