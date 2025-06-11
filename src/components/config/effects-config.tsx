import { useEffectsStore } from "@/store/effects";
import { folder, useControls } from "leva";
import { useEffect } from "react";
import {
  BLEND_FUNCTIONS,
  GLITCH_MODES,
  VIGNETTE_TECHNIQUES,
} from "@/constants/effects";
import { FONTS } from "@/constants/theming";

const PixelationEffect = () => {
  const setPixelation = useEffectsStore((state) => state.setPixelation);
  const pixelation = useEffectsStore((state) => state.pixelation);
  const props = useControls({
    effects: folder(
      {
        pixelation: folder(
          {
            ...pixelation,
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
    setPixelation(props);
  }, [props, setPixelation]);

  return null;
};

const BloomEffect = () => {
  const setBloom = useEffectsStore((state) => state.setBloom);
  const bloom = useEffectsStore((state) => state.bloom);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unused-vars
  const { blurPass, ...bloomProps } = bloom;

  const props = useControls({
    effects: folder(
      {
        bloom: folder(
          {
            ...(bloomProps as Omit<typeof bloom, "blurPass">),
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: bloom.blendFunction,
            },
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
    setBloom(props);
  }, [props, setBloom]);

  return null;
};

const NoiseEffect = () => {
  const setNoise = useEffectsStore((state) => state.setNoise);
  const noise = useEffectsStore((state) => state.noise);

  const props = useControls({
    effects: folder(
      {
        noise: folder(
          {
            ...noise,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: noise.blendFunction,
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
    setNoise(props);
  }, [props, setNoise]);

  return null;
};

const DepthOfFieldEffect = () => {
  const setDepthOfField = useEffectsStore((state) => state.setDepthOfField);
  const depthOfField = useEffectsStore((state) => state.depthOfField);

  const props = useControls({
    effects: folder(
      {
        "depth of field": folder(
          {
            ...depthOfField,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: depthOfField.blendFunction,
            },
            focusRange: {
              min: 0,
              max: 1,
              step: 0.01,
              value: depthOfField.focusRange,
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
    setDepthOfField(props);
  }, [props, setDepthOfField]);

  return null;
};

const GlitchEffect = () => {
  const gltich = useEffectsStore((state) => state.glitch);
  const setGlitch = useEffectsStore((state) => state.setGlitch);

  const props = useControls({
    effects: folder(
      {
        glitch: folder(
          {
            ...gltich,
            mode: {
              options: GLITCH_MODES,
              value: gltich.mode,
            },
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: gltich.blendFunction,
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
    setGlitch(props);
  }, [props, setGlitch]);

  return null;
};

const OutlineEffect = () => {
  const outline = useEffectsStore((state) => state.outline);
  const setOutline = useEffectsStore((state) => state.setOutline);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { kernelSize, patternTexture, ...outlineProps } = outline;

  const props = useControls({
    effects: folder(
      {
        outline: folder(
          {
            ...outlineProps,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: outline.blendFunction,
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
    setOutline(props);
  }, [props, setOutline]);

  return null;
};

const ASCIIEffect = () => {
  const setAscii = useEffectsStore((state) => state.setAscii);
  const ascii = useEffectsStore((state) => state.ascii);
  const props = useControls({
    effects: folder(
      {
        ascii: folder(
          {
            ...ascii,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: ascii.blendFunction,
            },
            font: {
              options: FONTS,
              value: ascii.font,
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
    setAscii(props);
  }, [props, setAscii]);

  return null;
};

const BrightnessContrastEffect = () => {
  const setBrightnessContrast = useEffectsStore(
    (state) => state.setBrightnessContrast
  );
  const brightnessContrast = useEffectsStore(
    (state) => state.brightnessContrast
  );

  const props = useControls({
    effects: folder(
      {
        "brightness and contrast": folder(
          {
            ...brightnessContrast,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: brightnessContrast.blendFunction,
            },
            brightness: {
              min: -1,
              max: 1,
              step: 0.01,
              value: brightnessContrast.brightness,
            },
            contrast: {
              min: -1,
              max: 1,
              step: 0.01,
              value: brightnessContrast.contrast,
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
    setBrightnessContrast(props);
  }, [props, setBrightnessContrast]);

  return null;
};

const ChromaticAberrationEffect = () => {
  const setChromaticAberration = useEffectsStore(
    (state) => state.setChromaticAberration
  );
  const chromaticAberration = useEffectsStore(
    (state) => state.chromaticAberration
  );

  const props = useControls({
    effects: folder(
      {
        "chromatic aberration": folder(
          {
            ...chromaticAberration,
            offset: {
              step: 0.001,
              value: chromaticAberration.offset,
            },
            modulationOffset: {
              min: 0,
              max: 1,
              step: 0.01,
              value: chromaticAberration.modulationOffset,
            },
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: chromaticAberration.blendFunction,
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
    setChromaticAberration(props);
  }, [props, setChromaticAberration]);

  return null;
};

const VignetteEffect = () => {
  const setVignette = useEffectsStore((state) => state.setVignette);
  const vignette = useEffectsStore((state) => state.vignette);

  const props = useControls({
    effects: folder(
      {
        vignette: folder(
          {
            ...vignette,
            technique: {
              options: VIGNETTE_TECHNIQUES,
              value: vignette.technique,
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
    setVignette(props);
  }, [props, setVignette]);
  return null;
};

const ColorAverageEffect = () => {
  const setColorAverage = useEffectsStore((state) => state.setColorAverage);
  const colorAverage = useEffectsStore((state) => state.colorAverage);

  const props = useControls({
    effects: folder(
      {
        colorAverage: folder(
          {
            ...colorAverage,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: colorAverage.blendFunction,
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
    setColorAverage(props);
  }, [props, setColorAverage]);

  return null;
};

const ColorDepthEffect = () => {
  const setColorDepth = useEffectsStore((state) => state.setColorDepth);
  const colorDepth = useEffectsStore((state) => state.colorDepth);

  const props = useControls({
    effects: folder(
      {
        colorDepth: folder(
          {
            ...colorDepth,
            bits: {
              min: 1,
              max: 12,
              step: 1,
              value: colorDepth.bits,
            },
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: colorDepth.blendFunction,
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
    setColorDepth(props);
  }, [props, setColorDepth]);

  return null;
};

const DepthEffect = () => {
  const setDepth = useEffectsStore((state) => state.setDepth);
  const depth = useEffectsStore((state) => state.depth);

  const props = useControls({
    effects: folder(
      {
        depth: folder(
          {
            ...depth,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: depth.blendFunction,
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
    setDepth(props);
  }, [props, setDepth]);

  return null;
};

const TiltShiftEffect = () => {
  const setTiltShift = useEffectsStore((state) => state.setTiltShift);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { kernelSize, ...tiltShift } = useEffectsStore(
    (state) => state.tiltShift
  );

  const props = useControls({
    effects: folder(
      {
        tiltShift: folder(
          {
            ...tiltShift,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: tiltShift.blendFunction,
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
    setTiltShift(props);
  }, [props, setTiltShift]);

  return null;
};

const TiltShift2Effect = () => {
  const setTiltShift2 = useEffectsStore((state) => state.setTiltShift2);
  const tiltShift2 = useEffectsStore((state) => state.tiltShift2);

  const props = useControls({
    effects: folder(
      {
        tiltShift2: folder(
          {
            ...tiltShift2,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: tiltShift2.blendFunction,
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
    setTiltShift2(props);
  }, [props, setTiltShift2]);

  return null;
};

const DotScreenEffect = () => {
  const setDotScreen = useEffectsStore((state) => state.setDotScreen);
  const dotScreen = useEffectsStore((state) => state.dotScreen);

  const props = useControls({
    effects: folder(
      {
        dotScreen: folder(
          {
            ...dotScreen,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: dotScreen.blendFunction,
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
    setDotScreen(props);
  }, [props, setDotScreen]);

  return null;
};

const HueSaturationEffect = () => {
  const setHueSaturation = useEffectsStore((state) => state.setHueSaturation);
  const hueSaturation = useEffectsStore((state) => state.hueSaturation);

  const props = useControls({
    effects: folder(
      {
        hueSaturation: folder(
          {
            ...hueSaturation,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: hueSaturation.blendFunction,
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
    setHueSaturation(props);
  }, [props, setHueSaturation]);

  return null;
};

const ScanLineEffect = () => {
  const setScanline = useEffectsStore((state) => state.setScanline);
  const scanline = useEffectsStore((state) => state.scanline);

  const props = useControls({
    effects: folder(
      {
        scanline: folder(
          {
            ...scanline,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: scanline.blendFunction,
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
    setScanline(props);
  }, [props, setScanline]);

  return null;
};

const SepiaEffect = () => {
  const setSepia = useEffectsStore((state) => state.setSepia);
  const sepia = useEffectsStore((state) => state.sepia);

  const props = useControls({
    effects: folder(
      {
        sepia: folder(
          {
            ...sepia,
            blendFunction: {
              options: BLEND_FUNCTIONS,
              value: sepia.blendFunction,
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
    setSepia(props);
  }, [props, setSepia]);

  return null;
};

export const EffectsConfig = () => {
  return (
    <>
      <ASCIIEffect />
      <BloomEffect />
      <BrightnessContrastEffect />
      <ChromaticAberrationEffect />
      <ColorAverageEffect />
      <ColorDepthEffect />
      <DepthEffect />
      <DepthOfFieldEffect />
      <DotScreenEffect />
      <GlitchEffect />
      <HueSaturationEffect />
      <NoiseEffect />
      <OutlineEffect />
      <PixelationEffect />
      <ScanLineEffect />
      <SepiaEffect />
      <TiltShiftEffect />
      <TiltShift2Effect />
      <VignetteEffect />
    </>
  );
};
