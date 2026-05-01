import type { EffectType } from "@/types/effects";
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

export const EFFECTS: { key: EffectType; name: string }[] = [
  { key: "grid", name: "Grid" },
  { key: "pixelation", name: "Pixelation" },
  { key: "glitch", name: "Glitch" },
  { key: "bloom", name: "Bloom" },
  { key: "depthOfField", name: "Depth of Field" },
  { key: "noise", name: "Noise" },
  { key: "vignette", name: "Vignette" },
  { key: "outline", name: "Outline" },
  { key: "ascii", name: "ASCII" },
  { key: "brightnessContrast", name: "Brightness / Contrast" },
  { key: "chromaticAberration", name: "Chromatic Aberration" },
  { key: "colorAverage", name: "Color Average" },
  { key: "colorDepth", name: "Color Depth" },
  { key: "depth", name: "Depth" },
  { key: "tiltShift", name: "Tilt Shift" },
  { key: "tiltShift2", name: "Tilt Shift 2" },
  { key: "dotScreen", name: "Dot Screen" },
  { key: "hueSaturation", name: "Hue / Saturation" },
  { key: "scanline", name: "Scanline" },
  { key: "sepia", name: "Sepia" },
  { key: "palette", name: "Palette" },
  { key: "dither", name: "Dither" },
  { key: "tonemap", name: "Tonemap" },
  { key: "customShader", name: "Custom Shader" },
  { key: "grid", name: "Grid" },
  { key: "shockwave", name: "Shockwave" },
  { key: "ssao", name: "SSAO" },
  { key: "smaa", name: "SMAA" },
  { key: "fxaa", name: "FXAA" },
  { key: "gammaCorrection", name: "Gamma Correction" },
  { key: "bokeh", name: "Bokeh" },
  { key: "smear", name: "Smear / Motion Blur" },
];

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
