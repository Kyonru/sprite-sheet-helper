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

export const EFFECTS = [
  {
    name: "Ascii",
    key: "ascii",
  },
  {
    name: "Bloom",
    key: "bloom",
  },
  {
    name: "Brightness and Contrast",
    key: "brightnessContrast",
  },
  {
    name: "Chromatic Aberration",
    key: "chromaticAberration",
  },
  {
    name: "Color Average",
    key: "colorAverage",
  },
  {
    name: "Color Depth",
    key: "colorDepth",
  },
  {
    name: "Depth",
    key: "depth",
  },
  {
    name: "Depth of Field",
    key: "depthOfField",
  },
  {
    name: "Dot Screen",
    key: "dotScreen",
  },
  {
    name: "Glitch",
    key: "glitch",
  },
  {
    name: "Hue and Saturation",
    key: "hueSaturation",
  },
  {
    name: "Noise",
    key: "noise",
  },
  {
    name: "Outline",
    key: "outline",
  },
  {
    name: "Pixelation",
    key: "pixelation",
  },
  {
    name: "Scanline",
    key: "scanline",
  },
  {
    name: "Sepia",
    key: "sepia",
  },
  {
    name: "Tilt Shift",
    key: "tiltShift",
  },
  {
    name: "Tilt Shift 2",
    key: "tiltShift2",
  },
  {
    name: "Vignette",
    key: "vignette",
  },
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
