import {
  GlitchMode,
  BlendFunction,
  KernelSize,
  Resolution,
  type BlurPass,
  EffectComposer,
} from "postprocessing";
import { create } from "zustand";

interface Feature {
  enabled: boolean;
}

interface Pixelation extends Feature {
  granularity: number;
}

interface Glitch extends Feature {
  blendFunction: BlendFunction;
  chromaticAberrationOffset: [number, number];
  delay: [number, number];
  duration: [number, number];
  strength: [number, number];
  mode: GlitchMode;
  dtSize: number;
  columns: number;
  ratio: number;
}

interface Outline extends Feature {
  blendFunction: BlendFunction;
  width: number;
  height: number;
  selectionLayer: number;
  patternTexture: number | null;
  edgeStrength: number;
  pulseSpeed: number;
  visibleEdgeColor: string;
  hiddenEdgeColor: string;
  kernelSize: KernelSize;
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
  kernelSize: KernelSize;
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
  composer?: EffectComposer | null;
  setComposer: (composer: EffectComposer | null) => void;

  pixelation: {
    enabled: boolean;
    granularity: number;
  };
  setPixelation: (props: Partial<Pixelation>) => void;

  glitch: Glitch;
  setGlitch: (props: Partial<Glitch>) => void;

  bloom: Bloom;
  setBloom: (props: Partial<Bloom>) => void;

  depthOfField: DepthOfField;
  setDepthOfField: (props: Partial<DepthOfField>) => void;

  noise: Noise;
  setNoise: (props: Partial<Noise>) => void;

  vignette: Vignette;
  setVignette: (props: Partial<Vignette>) => void;

  outline: Outline;
  setOutline: (props: Partial<Outline>) => void;

  // TODO: add more effects
}

export const useEffectsStore = create<EffectsState>((set) => ({
  composer: null,
  setComposer: (composer: EffectComposer | null) =>
    set(() => ({ composer: composer })),

  pixelation: {
    enabled: false,
    granularity: 2,
  },
  setPixelation: (props: Partial<Pixelation>) =>
    set((state) => ({
      ...state,
      pixelation: { ...state.pixelation, ...props },
    })),

  glitch: {
    blendFunction: BlendFunction.NORMAL,
    enabled: false,
    delay: [1.5, 3.5],
    duration: [0.6, 1.0],
    strength: [0.3, 1.0],
    chromaticAberrationOffset: [0, 0],
    dtSize: 64,
    columns: 0.05,
    mode: GlitchMode.SPORADIC,
    ratio: 0.85,
  },
  setGlitch: (props: Partial<Glitch>) =>
    set((state) => ({ ...state, glitch: { ...state.glitch, ...props } })),

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
  setBloom: (props: Partial<Bloom>) =>
    set((state) => ({ ...state, bloom: { ...state.bloom, ...props } })),

  depthOfField: {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    focusDistance: 0,
    focalLength: 0.02,
    bokehScale: 2,
    height: Resolution.AUTO_SIZE,
    width: Resolution.AUTO_SIZE,
  },
  setDepthOfField: (props: Partial<DepthOfField>) =>
    set((state) => ({
      ...state,
      depthOfField: { ...state.depthOfField, ...props },
    })),

  noise: {
    enabled: false,
    premultiply: false,
    blendFunction: BlendFunction.SCREEN,
  },
  setNoise: (props: Partial<Noise>) =>
    set((state) => ({
      ...state,
      noise: {
        ...state.noise,
        ...props,
      },
    })),

  vignette: {
    enabled: false,
    eskil: false,
    offset: 0.1,
    darkness: 1.1,
  },
  setVignette: (props: Partial<Vignette>) =>
    set((state) => ({ ...state, vignette: { ...state.vignette, ...props } })),

  outline: {
    enabled: false,
    selectionLayer: 10,
    blendFunction: BlendFunction.SCREEN,
    patternTexture: null,
    edgeStrength: 2.5,
    pulseSpeed: 0,
    visibleEdgeColor: "#ffffff",
    hiddenEdgeColor: "#22090a",
    width: Resolution.AUTO_SIZE,
    height: Resolution.AUTO_SIZE,
    kernelSize: KernelSize.VERY_SMALL,
    blur: false,
    xRay: true,
  },
  setOutline: (props: Partial<Outline>) =>
    set((state) => ({ ...state, outline: { ...state.outline, ...props } })),
}));
