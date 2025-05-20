import { BlendFunction, GlitchMode } from "postprocessing";

export const getBlendFunctionName = (value: BlendFunction) => {
  const v = Object.keys(BlendFunction).find(
    (key) => BlendFunction[key as keyof typeof BlendFunction] === value
  );

  return v || "";
};

export const getBlendFunctionValue = (key: string) => {
  return BlendFunction[key as keyof typeof BlendFunction];
};

export const getGlitchModeName = (value: GlitchMode) => {
  const v = Object.keys(GlitchMode).find(
    (key) => GlitchMode[key as keyof typeof GlitchMode] === value
  );

  return v || "";
};

export const getGlitchModeValue = (key: string) => {
  return GlitchMode[key as keyof typeof GlitchMode];
};
