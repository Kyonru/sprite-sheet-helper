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
