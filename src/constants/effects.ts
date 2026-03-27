import type { EffectType } from "@/store/next/effects";
import type { LightType } from "@/types/lighting";
import { BlendFunction, GlitchMode, VignetteTechnique } from "postprocessing";

export const BLEND_FUNCTIONS = Object.keys(BlendFunction)
  .map((key: string) => {
    return {
      [key]: BlendFunction[key as keyof typeof BlendFunction],
    };
  })
  .reduce((a, b) => Object.assign(a, b), {});

export const GLITCH_MODES = Object.keys(GlitchMode)
  .map((key: string) => {
    return {
      [key]: GlitchMode[key as keyof typeof GlitchMode],
    };
  })
  .reduce((a, b) => Object.assign(a, b), {});

export const VIGNETTE_TECHNIQUES = Object.keys(VignetteTechnique)
  .map((key: string) => {
    return {
      [key]: VignetteTechnique[key as keyof typeof VignetteTechnique],
    };
  })
  .reduce((a, b) => Object.assign(a, b), {});

export const EFFECTS: { key: EffectType; name: string }[] = [
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
