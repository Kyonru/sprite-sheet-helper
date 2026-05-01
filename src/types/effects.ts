import {
  GlitchMode,
  BlendFunction,
  KernelSize,
  VignetteTechnique,
  ToneMappingMode,
  SMAAPreset,
  EdgeDetectionMode,
  PredicationMode,
} from "postprocessing";

export type EffectType =
  | "pixelation"
  | "glitch"
  | "bloom"
  | "depthOfField"
  | "noise"
  | "vignette"
  | "outline"
  | "ascii"
  | "brightnessContrast"
  | "chromaticAberration"
  | "colorAverage"
  | "colorDepth"
  | "depth"
  | "tiltShift"
  | "tiltShift2"
  | "dotScreen"
  | "hueSaturation"
  | "scanline"
  | "sepia"
  | "palette"
  | "dither"
  | "tonemap"
  | "customShader"
  | "grid"
  | "shockwave"
  | "gammaCorrection"
  | "bokeh"
  | "ssao"
  | "smaa"
  | "fxaa"
  | "smear";

export type EffectComponent = { type: EffectType; enabled: boolean } & (
  | { type: "pixelation"; granularity: number }
  | {
      type: "glitch";
      delay: [number, number];
      duration: [number, number];
      strength: [number, number];
      chromaticAberrationOffset: [number, number];
      dtSize: number;
      columns: number;
      mode: GlitchMode;
      ratio: number;
    }
  | {
      type: "bloom";
      blendFunction: BlendFunction;
      luminanceThreshold: number;
      luminanceSmoothing: number;
      intensity: number;
      mipmapBlur: boolean;
      levels: number;
      radius: number;
    }
  | {
      type: "depthOfField";
      blendFunction: BlendFunction;
      focusDistance: number;
      focusRange: number;
      worldFocusDistance: number;
      worldFocusRange: number;
      bokehScale: number;
      resolutionScale: number;
      resolutionX: number;
      resolutionY: number;
    }
  | { type: "noise"; premultiply: boolean; blendFunction: BlendFunction }
  | {
      type: "vignette";
      offset: number;
      darkness: number;
      technique: VignetteTechnique;
    }
  | {
      type: "outline";
      blendFunction: BlendFunction;
      edgeStrength: number;
      pulseSpeed: number;
      visibleEdgeColor: string;
      hiddenEdgeColor: string;
      kernelSize: KernelSize;
      blur: boolean;
      xRay: boolean;
      multisampling: number;
      resolutionScale: number;
      resolutionX: number;
      resolutionY: number;
    }
  | {
      type: "ascii";
      characters: string;
      invert: boolean;
      font: string;
      fontSize: number;
      cellSize: number;
      color: string;
      blendFunction: BlendFunction;
    }
  | {
      type: "brightnessContrast";
      brightness: number;
      contrast: number;
      blendFunction: BlendFunction;
    }
  | {
      type: "chromaticAberration";
      radialModulation: boolean;
      modulationOffset: number;
      offset: [number, number];
      blendFunction: BlendFunction;
    }
  | { type: "colorAverage"; blendFunction: BlendFunction }
  | { type: "colorDepth"; bits: number; blendFunction: BlendFunction }
  | { type: "depth"; inverted: boolean; blendFunction: BlendFunction }
  | {
      type: "tiltShift";
      blendFunction: BlendFunction;
      offset: number;
      rotation: number;
      focusArea: number;
      feather: number;
      kernelSize: KernelSize;
      resolutionScale: number;
      resolutionX: number;
      resolutionY: number;
    }
  | {
      type: "tiltShift2";
      blendFunction: BlendFunction;
      blur: number;
      taper: number;
      start: [number, number];
      end: [number, number];
      samples: number;
      direction: [number, number];
    }
  | {
      type: "dotScreen";
      blendFunction: BlendFunction;
      angle: number;
      scale: number;
    }
  | {
      type: "hueSaturation";
      hue: number;
      saturation: number;
      blendFunction: BlendFunction;
    }
  | {
      type: "scanline";
      blendFunction: BlendFunction;
      density: number;
      scrollSpeed: number;
    }
  | { type: "sepia"; intensity: number; blendFunction: BlendFunction }
  | { type: "palette"; palette: number }
  | { type: "dither"; ditherStrength: number; ditherScale: number }
  | {
      type: "tonemap";
      blendFunction: BlendFunction;
      adaptive: boolean;
      mode: ToneMappingMode;
      whitePoint: number;
      minLuminance: number;
      resolution: number;
      middleGrey: number;
      maxLuminance: number;
      averageLuminance: number;
      adaptationRate: number;
    }
  | { type: "customShader"; fragmentShader: string }
  | {
      type: "grid";
      scale: number;
      lineWidth: number;
      blendFunction: BlendFunction;
    }
  | {
      type: "shockwave";
      blendFunction: BlendFunction;
      speed: number;
      position: [number, number, number];
      maxRadius: number;
      amplitude: number;
      wavelength: number;
    }
  | {
      type: "ssao";
      blendFunction: BlendFunction;
      depthAwareUpsampling: boolean;
      samples: number;
      rings: number;
      worldDistanceThreshold: number;
      worldDistanceFalloff: number;
      worldProximityThreshold: number;
      worldProximityFalloff: number;
      minRadiusScale: number;
      luminanceInfluence: number;
      radius: number;
      intensity: number;
      bias: number;
      fade: number;
      color: string;
      resolutionScale: number;
      resolutionX: number;
      resolutionY: number;
    }
  | {
      type: "smaa";
      blendFunction: BlendFunction;
      preset: SMAAPreset;
      edgeDetectionMode: EdgeDetectionMode;
      predicationMode: PredicationMode;
    }
  | {
      type: "fxaa";
      blendFunction: BlendFunction;
    }
  | {
      type: "gammaCorrection";
      blendFunction: BlendFunction;
      gamma: number;
    }
  | {
      type: "bokeh";
      blendFunction: BlendFunction;
      focus: number;
      dof: number;
      aperture: number;
      maxBlur: number;
    }
  | { type: "smear"; damp: number; tint: string; legacy: boolean }
);
