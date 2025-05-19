import {
  GlitchMode,
  BlendFunction,
  KernelSize,
  Resolution,
  type BlurPass,
} from "postprocessing";
import { create } from "zustand";

interface Feature {
  enabled: boolean;
}

interface Pixelation extends Feature {
  granularity: number;
}

interface Glitch extends Feature {
  delay: number[];
  duration: number[];
  strength: number[];
  mode: number;
  ratio: number;
}

interface Outline extends Feature {
  selectionLayer: number;
  blendFunction: number;
  patternTexture: number | null;
  edgeStrength: number;
  pulseSpeed: number;
  visibleEdgeColor: number;
  hiddenEdgeColor: number;
  width: number;
  height: number;
  kernelSize: number;
  blur: boolean;
  xRay: boolean;
}

interface DepthOfField extends Feature {
  blendFunction: BlendFunction;
  focusDistance: number;
  focalLength: number;
  bokehScale: number;
  width: number;
  height: number;
}

interface Bloom extends Feature {
  luminanceThreshold: number;
  luminanceSmoothing: number;
  intensity: number;
  blurPass?: BlurPass;
  kernelSize: number;
  mipmapBlur: boolean;
  resolutionX: number;
  resolutionY: number;
}

interface Noise extends Feature {
  premultiply: boolean;
  blendFunction: BlendFunction;
}

interface Vignette extends Feature {
  eskil: boolean;
  offset: number;
  darkness: number;
}

interface EffectsState {
  pixelation: {
    enabled: boolean;
    granularity: number;
  };
  setPixelation: (props: Pixelation) => void;

  glitch: Glitch;
  setGlitch: (props: Glitch) => void;

  bloom: Bloom;
  setBloom: (props: Bloom) => void;

  depthOfField: DepthOfField;
  setDepthOfField: (props: DepthOfField) => void;

  noise: Noise;
  setNoise: (props: Noise) => void;

  vignette: Vignette;
  setVignette: (props: Vignette) => void;

  outline: Outline;
  setOutline: (props: Outline) => void;

  // TODO: add more effects
}

export const useEffectsStore = create<EffectsState>((set) => ({
  pixelation: {
    enabled: false,
    granularity: 5,
  },
  setPixelation: (props: Pixelation) => set(() => ({ pixelation: props })),

  glitch: {
    enabled: false,
    delay: [1.5, 3.5],
    duration: [0.6, 1.0],
    strength: [0.3, 1.0],
    mode: GlitchMode.SPORADIC,
    ratio: 0.85,
  },
  setGlitch: (props: Glitch) => set(() => ({ glitch: props })),

  bloom: {
    enabled: false,
    luminanceThreshold: 0.025,
    luminanceSmoothing: 0.9,
    intensity: 1.0,
    blurPass: undefined,
    kernelSize: KernelSize.LARGE,
    mipmapBlur: false,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
  },
  setBloom: (props: Bloom) => set(() => ({ bloom: props })),

  depthOfField: {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    focusDistance: 0,
    focalLength: 0.02,
    bokehScale: 2,
    height: Resolution.AUTO_SIZE,
    width: Resolution.AUTO_SIZE,
  },
  setDepthOfField: (props: DepthOfField) =>
    set(() => ({ depthOfField: props })),

  noise: {
    enabled: false,
    premultiply: false,
    blendFunction: BlendFunction.SCREEN,
  },
  setNoise: (props: Noise) => set(() => ({ noise: props })),

  vignette: {
    enabled: false,
    eskil: false,
    offset: 0.1,
    darkness: 1.1,
  },
  setVignette: (props: Vignette) => set(() => ({ vignette: props })),

  outline: {
    enabled: false,
    selectionLayer: 10,
    blendFunction: BlendFunction.SCREEN,
    patternTexture: null,
    edgeStrength: 2.5,
    pulseSpeed: 0,
    visibleEdgeColor: 0xffffff,
    hiddenEdgeColor: 0x22090a,
    width: Resolution.AUTO_SIZE,
    height: Resolution.AUTO_SIZE,
    kernelSize: KernelSize.LARGE,
    blur: false,
    xRay: true,
  },
  setOutline: (props: Outline) => set(() => ({ outline: props })),
}));
