import { useEffectsStore } from "@/store/effects";
import { folder, useControls } from "leva";
import { useEffect } from "react";
import { BLEND_FUNCTIONS, GLITCH_MODES } from "@/constants/effects";
import {
  getBlendFunctionName,
  getBlendFunctionValue,
  getGlitchModeName,
  getGlitchModeValue,
} from "@/utils/effects";

const PixelationEffect = () => {
  const setPixelation = useEffectsStore((state) => state.setPixelation);
  const pixelation = useEffectsStore((state) => state.pixelation);
  const { enabled, granularity } = useControls({
    effects: folder(
      {
        pixelation: folder(
          {
            enabled: pixelation.enabled,
            granularity: pixelation.granularity,
          },
          {
            collapsed: true,
          }
        ),
      },
      {
        collapsed: true,
      }
    ),
  });

  useEffect(() => {
    setPixelation({
      enabled: enabled,
      granularity: granularity,
    });
  }, [enabled, granularity, setPixelation]);

  return null;
};

const BloomEffect = () => {
  const setBloom = useEffectsStore((state) => state.setBloom);
  const bloom = useEffectsStore((state) => state.bloom);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { blurPass, kernelSize, ...bloomProps } = bloom;

  const {
    enabled,
    luminanceSmoothing,
    luminanceThreshold,
    intensity,
    mipmapBlur,
    resolutionX,
    resolutionY,
  } = useControls({
    effects: folder(
      {
        bloom: folder(
          {
            ...bloomProps,
            luminanceSmoothing: {
              min: 0,
              max: 1,
              step: 0.01,
              value: bloom.luminanceSmoothing,
            },
            luminanceThreshold: {
              min: 0,
              max: 1,
              step: 0.01,
              value: bloom.luminanceThreshold,
            },
          },
          {
            collapsed: true,
          }
        ),
      },
      {
        collapsed: true,
      }
    ),
  });

  useEffect(() => {
    setBloom({
      enabled,
      luminanceSmoothing,
      luminanceThreshold,
      intensity,
      mipmapBlur,
      resolutionX,
      resolutionY,
    });
  }, [
    enabled,
    luminanceSmoothing,
    luminanceThreshold,
    intensity,
    mipmapBlur,
    resolutionX,
    resolutionY,
    setBloom,
  ]);

  return null;
};

const NoiseEffect = () => {
  const setNoise = useEffectsStore((state) => state.setNoise);
  const noise = useEffectsStore((state) => state.noise);

  const { enabled, blendFunction, premultiply } = useControls({
    effects: folder(
      {
        noise: folder(
          {
            enabled: noise.enabled,
            premultiply: noise.premultiply,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: getBlendFunctionName(noise.blendFunction),
            },
          },
          {
            collapsed: true,
          }
        ),
      },
      {
        collapsed: true,
      }
    ),
  });

  useEffect(() => {
    setNoise({
      enabled: enabled,
      premultiply: premultiply,
      blendFunction: getBlendFunctionValue(blendFunction),
    });
  }, [enabled, premultiply, blendFunction, setNoise]);

  return null;
};

const DepthOfFieldEffect = () => {
  const setDepthOfField = useEffectsStore((state) => state.setDepthOfField);
  const depthOfField = useEffectsStore((state) => state.depthOfField);

  const {
    blendFunction,
    focusDistance,
    focalLength,
    bokehScale,
    width,
    height,
  } = useControls({
    effects: folder(
      {
        "depth of field": folder(
          {
            ...depthOfField,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: getBlendFunctionName(depthOfField.blendFunction),
            },
            focalLength: {
              min: 0,
              max: 1,
              step: 0.01,
              value: depthOfField.focalLength,
            },
            focusDistance: {
              min: 0,
              max: 1,
              step: 0.01,
              value: depthOfField.focusDistance,
            },
          },
          {
            collapsed: true,
          }
        ),
      },
      {
        collapsed: true,
      }
    ),
  });

  useEffect(() => {
    setDepthOfField({
      blendFunction: getBlendFunctionValue(blendFunction),
      focusDistance,
      focalLength,
      bokehScale,
      width,
      height,
    });
  }, [
    blendFunction,
    focusDistance,
    focalLength,
    bokehScale,
    width,
    height,
    setDepthOfField,
  ]);

  return null;
};

const GlitchEffect = () => {
  const gltich = useEffectsStore((state) => state.glitch);
  const setGlitch = useEffectsStore((state) => state.setGlitch);

  const {
    enabled,
    delay,
    duration,
    strength,
    mode,
    ratio,
    chromaticAberrationOffset,
    columns,
    dtSize,
    blendFunction,
  } = useControls({
    effects: folder(
      {
        glitch: folder(
          {
            ...gltich,
            mode: {
              options: GLITCH_MODES,
              value: getGlitchModeName(gltich.mode),
            },
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: getBlendFunctionName(gltich.blendFunction),
            },
          },
          {
            collapsed: true,
          }
        ),
      },
      {
        collapsed: true,
      }
    ),
  });

  useEffect(() => {
    setGlitch({
      enabled,
      delay,
      duration,
      strength,
      mode: getGlitchModeValue(mode),
      ratio,
      chromaticAberrationOffset,
      columns,
      dtSize,
      blendFunction: getBlendFunctionValue(blendFunction),
    });
  }, [
    enabled,
    delay,
    duration,
    strength,
    mode,
    ratio,
    chromaticAberrationOffset,
    columns,
    dtSize,
    blendFunction,
    setGlitch,
  ]);

  return null;
};

const OutlineEffect = () => {
  const outline = useEffectsStore((state) => state.outline);
  const setOutline = useEffectsStore((state) => state.setOutline);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { kernelSize, patternTexture, ...outlineProps } = outline;

  const {
    enabled,
    selectionLayer,
    blendFunction,
    edgeStrength,
    pulseSpeed,
    visibleEdgeColor,
    hiddenEdgeColor,
    width,
    height,
    blur,
    xRay,
  } = useControls({
    effects: folder(
      {
        outline: folder(
          {
            ...outlineProps,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: getBlendFunctionName(outline.blendFunction),
            },
          },
          {
            collapsed: true,
          }
        ),
      },
      {
        collapsed: true,
      }
    ),
  });

  useEffect(() => {
    setOutline({
      enabled,
      selectionLayer,
      blendFunction: getBlendFunctionValue(blendFunction),
      edgeStrength,
      pulseSpeed,
      visibleEdgeColor,
      hiddenEdgeColor,
      width,
      height,
      blur,
      xRay,
    });
  }, [
    enabled,
    selectionLayer,
    blendFunction,
    edgeStrength,
    pulseSpeed,
    visibleEdgeColor,
    hiddenEdgeColor,
    width,
    height,
    blur,
    xRay,
    setOutline,
  ]);

  return null;
};

export const EffectsConfig = () => {
  return (
    <>
      <PixelationEffect />
      <BloomEffect />
      <NoiseEffect />
      <DepthOfFieldEffect />
      <GlitchEffect />
      <OutlineEffect />
    </>
  );
};
