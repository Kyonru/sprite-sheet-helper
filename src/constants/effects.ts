import type { EffectComponent, EffectType } from "@/types/effects";
import type { LightType } from "@/types/lighting";
import {
  BlendFunction,
  EdgeDetectionMode,
  GlitchMode,
  PredicationMode,
  SMAAPreset,
  ToneMappingMode,
  VignetteTechnique,
} from "postprocessing";

export const EnumToArray = <T>(
  obj: T extends Record<string, unknown> ? T : never,
) => {
  return Object.keys(obj)
    .map((key: string) => {
      return {
        [key]: obj[key as keyof typeof obj],
      };
    })
    .reduce((a, b) => Object.assign(a, b), {});
};

export const BLEND_FUNCTIONS = EnumToArray(BlendFunction);

export const VIGNETTE_TECHNIQUES = EnumToArray(VignetteTechnique);

export const GLITCH_MODES = EnumToArray(GlitchMode);

export const SMAA_PRESETS = EnumToArray(SMAAPreset);

export const TONE_MAPPING_MODES = EnumToArray(ToneMappingMode);

export const EDGE_DETECTION_MODES = EnumToArray(EdgeDetectionMode);

export const PREDICATION_MODES = EnumToArray(PredicationMode);

export type EffectCategory =
  | "color"
  | "stylization"
  | "lighting"
  | "debug"
  | "post-process";

export type EffectWarningKind =
  | "normal-map"
  | "reproducibility"
  | "performance";

export type EffectMetadata = {
  key: EffectType;
  name: string;
  category: EffectCategory;
  description: string;
  warnings?: EffectWarningKind[];
};

export type EffectPresetId =
  | "pixel-art"
  | "toon"
  | "depth-debug"
  | "game-boy";

export type EffectPreset = {
  id: EffectPresetId;
  name: string;
  description: string;
  effects: Array<{
    type: EffectType;
    props?: Partial<EffectComponent>;
  }>;
};

export const EFFECT_CATEGORY_LABELS: Record<EffectCategory, string> = {
  color: "Color",
  stylization: "Stylization",
  lighting: "Lighting",
  debug: "Debug",
  "post-process": "Post-process",
};

export const EFFECT_CATEGORY_ORDER: EffectCategory[] = [
  "color",
  "stylization",
  "lighting",
  "debug",
  "post-process",
];

export const EFFECT_METADATA: EffectMetadata[] = [
  {
    key: "brightnessContrast",
    name: "Brightness / Contrast",
    category: "color",
    description: "Adjust value range before final color grading.",
  },
  {
    key: "hueSaturation",
    name: "Hue / Saturation",
    category: "color",
    description: "Shift hue and saturation for art direction passes.",
  },
  {
    key: "sepia",
    name: "Sepia",
    category: "color",
    description: "Warm monochrome tone for aged or cinematic sprites.",
  },
  {
    key: "colorAverage",
    name: "Color Average",
    category: "color",
    description: "Flatten color variation into a washed, graphic look.",
  },
  {
    key: "colorDepth",
    name: "Color Depth",
    category: "color",
    description: "Reduce color precision for retro palettes.",
  },
  {
    key: "palette",
    name: "Palette",
    category: "color",
    description: "Map colors into a fixed palette.",
  },
  {
    key: "dither",
    name: "Dither",
    category: "color",
    description: "Add ordered dither texture for limited-color exports.",
  },
  {
    key: "tonemap",
    name: "Tonemap",
    category: "color",
    description: "Apply filmic tone mapping to bright scenes.",
  },
  {
    key: "gammaCorrection",
    name: "Gamma Correction",
    category: "color",
    description: "Correct final gamma for consistent brightness.",
  },
  {
    key: "pixelation",
    name: "Pixelation",
    category: "stylization",
    description: "Quantize the image into chunky pixel cells.",
  },
  {
    key: "ascii",
    name: "ASCII",
    category: "stylization",
    description: "Render the scene as text characters.",
  },
  {
    key: "dotScreen",
    name: "Dot Screen",
    category: "stylization",
    description: "Halftone dot pattern for print-style sprites.",
  },
  {
    key: "scanline",
    name: "Scanline",
    category: "stylization",
    description: "Horizontal display scanlines for CRT looks.",
    warnings: ["reproducibility"],
  },
  {
    key: "glitch",
    name: "Glitch",
    category: "stylization",
    description: "Temporal corruption and digital breakup.",
    warnings: ["reproducibility"],
  },
  {
    key: "chromaticAberration",
    name: "Chromatic Aberration",
    category: "stylization",
    description: "Offset color channels for lens distortion.",
  },
  {
    key: "vignette",
    name: "Vignette",
    category: "stylization",
    description: "Darken edges to focus the sprite silhouette.",
  },
  {
    key: "smear",
    name: "Smear / Motion Blur",
    category: "stylization",
    description: "Blend previous frames into motion trails.",
    warnings: ["reproducibility"],
  },
  {
    key: "shockwave",
    name: "Shockwave",
    category: "stylization",
    description: "Radial animated distortion centered in the scene.",
    warnings: ["reproducibility"],
  },
  {
    key: "bloom",
    name: "Bloom",
    category: "lighting",
    description: "Glow bright pixels and emissive materials.",
    warnings: ["performance"],
  },
  {
    key: "ssao",
    name: "SSAO",
    category: "lighting",
    description: "Screen-space contact shadowing for creases and joints.",
    warnings: ["performance"],
  },
  {
    key: "depthOfField",
    name: "Depth of Field",
    category: "post-process",
    description: "Blur out-of-focus depth ranges.",
    warnings: ["performance"],
  },
  {
    key: "bokeh",
    name: "Bokeh",
    category: "post-process",
    description: "Lens-style blur highlights.",
    warnings: ["performance"],
  },
  {
    key: "tiltShift",
    name: "Tilt Shift",
    category: "post-process",
    description: "Planar blur band for miniature-style focus.",
    warnings: ["performance"],
  },
  {
    key: "tiltShift2",
    name: "Tilt Shift 2",
    category: "post-process",
    description: "Alternate tilt-shift blur controls.",
    warnings: ["performance"],
  },
  {
    key: "noise",
    name: "Noise",
    category: "post-process",
    description: "Screen noise overlay.",
    warnings: ["reproducibility"],
  },
  {
    key: "fxaa",
    name: "FXAA",
    category: "post-process",
    description: "Fast antialiasing pass.",
  },
  {
    key: "smaa",
    name: "SMAA",
    category: "post-process",
    description: "Higher-quality antialiasing pass.",
  },
  {
    key: "outline",
    name: "Outline",
    category: "debug",
    description: "Depth and object edge highlighting.",
    warnings: ["performance"],
  },
  {
    key: "depth",
    name: "Depth",
    category: "debug",
    description: "Visualize scene depth for troubleshooting.",
  },
  {
    key: "grid",
    name: "Grid",
    category: "debug",
    description: "Overlay alignment grid lines.",
  },
  {
    key: "customShader",
    name: "Custom Shader",
    category: "debug",
    description: "Author a custom fragment shader pass.",
  },
];

export const EFFECT_METADATA_BY_TYPE = Object.fromEntries(
  EFFECT_METADATA.map((effect) => [effect.key, effect]),
) as Record<EffectType, EffectMetadata>;

export const EFFECTS: { key: EffectType; name: string }[] =
  EFFECT_METADATA.map(({ key, name }) => ({ key, name }));

export const EFFECT_PRESETS: Record<EffectPresetId, EffectPreset> = {
  "pixel-art": {
    id: "pixel-art",
    name: "Pixel Art",
    description: "Chunky pixels with reduced color depth and dither.",
    effects: [
      { type: "pixelation", props: { granularity: 4 } },
      { type: "colorDepth", props: { bits: 8 } },
      { type: "dither", props: { ditherStrength: 0.35, ditherScale: 1 } },
      { type: "gammaCorrection", props: { gamma: 2 } },
    ],
  },
  toon: {
    id: "toon",
    name: "Toon",
    description: "Readable outlines with clean color grading.",
    effects: [
      { type: "outline", props: { edgeStrength: 1.5, blur: false } },
      { type: "brightnessContrast", props: { brightness: 0, contrast: 0.12 } },
      { type: "gammaCorrection", props: { gamma: 2 } },
    ],
  },
  "depth-debug": {
    id: "depth-debug",
    name: "Depth Debug",
    description: "Inspect depth and silhouette boundaries.",
    effects: [
      { type: "depth" },
      { type: "outline", props: { edgeStrength: 1, xRay: false } },
    ],
  },
  "game-boy": {
    id: "game-boy",
    name: "Game Boy",
    description: "Small pixels, limited palette, dither, and scanlines.",
    effects: [
      { type: "pixelation", props: { granularity: 3 } },
      { type: "palette", props: { palette: 1 } },
      { type: "dither", props: { ditherStrength: 0.45, ditherScale: 1 } },
      { type: "scanline", props: { density: 0.7, scrollSpeed: 0 } },
    ],
  },
};

export const LIGHTS: {
  name: string;
  key: LightType;
}[] = [
  {
    name: "Ambient",
    key: "ambient",
  },
  {
    name: "Directional",
    key: "directional",
  },
  // {
  //   name: "Hemisphere",
  //   key: "hemisphere",
  // },
  {
    name: "Point",
    key: "point",
  },
  {
    name: "Spot",
    key: "spot",
  },
];
