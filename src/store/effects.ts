import {
  GlitchMode,
  BlendFunction,
  KernelSize,
  Resolution,
  type BlurPass,
  EffectComposer,
  PixelationEffect,
  VignetteTechnique,
} from "postprocessing";
import { create } from "zustand";

interface Feature {
  enabled: boolean;
}

interface Pixelation extends Feature, PixelationEffect {
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
  selectionLayer: number;
  patternTexture: number | null;
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

interface DepthOfField extends Feature {
  blendFunction: BlendFunction;
  focusDistance: number;
  bokehScale: number;
  worldFocusDistance: number;
  worldFocusRange: number;
  focusRange: number;
  resolutionScale: number;
  resolutionX: number;
  resolutionY: number;
}

interface Bloom extends Feature {
  luminanceThreshold: number;
  luminanceSmoothing: number;
  intensity: number;
  blurPass?: BlurPass;
  mipmapBlur: boolean;
  resolutionX: number;
  resolutionY: number;
  levels: number;
  radius: number;
  blendFunction: BlendFunction;
}

interface Noise extends Feature {
  premultiply: boolean;
  blendFunction: BlendFunction;
}

interface Vignette extends Feature {
  offset: number;
  darkness: number;
  technique: VignetteTechnique;
}

interface ASCII extends Feature {
  characters: string;
  invert: boolean;
  font: string;
  fontSize: number;
  cellSize: number;
  color: string;
  blendFunction: BlendFunction;
}

interface BrightnessContrast extends Feature {
  brightness: number;
  contrast: number;
  blendFunction: BlendFunction;
}

interface ChromaticAberration extends Feature {
  radialModulation: boolean;
  modulationOffset: number;
  offset: [number, number];
  blendFunction: BlendFunction;
}

interface ColorAverage extends Feature {
  blendFunction: BlendFunction;
}

interface ColorDepth extends Feature {
  bits: number;
  blendFunction: BlendFunction;
}

interface Depth extends Feature {
  inverted: boolean;
  blendFunction: BlendFunction;
}

interface TiltShift extends Feature {
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

interface TiltShift2 extends Feature {
  blendFunction: BlendFunction;
  blur: number;
  taper: number;
  start: [number, number];
  end: [number, number];
  samples: number;
  direction: [number, number];
}

interface DotScreen extends Feature {
  blendFunction: BlendFunction;
  angle: number;
  scale: number;
}

interface HueSaturation extends Feature {
  hue: number;
  saturation: number;
  blendFunction: BlendFunction;
}

interface Scanline extends Feature {
  blendFunction: BlendFunction;
  density: number;
}

interface Sepia extends Feature {
  intensity: number;
  blendFunction: BlendFunction;
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

  ascii: ASCII;
  setAscii: (props: Partial<ASCII>) => void;

  brightnessContrast: BrightnessContrast;
  setBrightnessContrast: (props: Partial<BrightnessContrast>) => void;

  chromaticAberration: ChromaticAberration;
  setChromaticAberration: (props: Partial<ChromaticAberration>) => void;

  colorAverage: ColorAverage;
  setColorAverage: (props: Partial<ColorAverage>) => void;

  colorDepth: ColorDepth;
  setColorDepth: (props: Partial<ColorDepth>) => void;

  depth: Depth;
  setDepth: (props: Partial<Depth>) => void;

  tiltShift: TiltShift;
  setTiltShift: (props: Partial<TiltShift>) => void;

  tiltShift2: TiltShift2;
  setTiltShift2: (props: Partial<TiltShift2>) => void;

  dotScreen: DotScreen;
  setDotScreen: (props: Partial<DotScreen>) => void;

  hueSaturation: HueSaturation;
  setHueSaturation: (props: Partial<HueSaturation>) => void;

  scanline: Scanline;
  setScanline: (props: Partial<Scanline>) => void;

  sepia: Sepia;
  setSepia: (props: Partial<Sepia>) => void;
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
    blendFunction: BlendFunction.ADD,
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
    mipmapBlur: false,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
    levels: 1,
    radius: 0.5,
    blendFunction: BlendFunction.ADD,
  },
  setBloom: (props: Partial<Bloom>) =>
    set((state) => ({ ...state, bloom: { ...state.bloom, ...props } })),

  depthOfField: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    focusDistance: 0,
    focusRange: 0.1,
    worldFocusDistance: 0,
    worldFocusRange: 0,
    resolutionScale: 1,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
    bokehScale: 1,
  },
  setDepthOfField: (props: Partial<DepthOfField>) =>
    set((state) => ({
      ...state,
      depthOfField: { ...state.depthOfField, ...props },
    })),

  noise: {
    enabled: false,
    premultiply: false,
    blendFunction: BlendFunction.ADD,
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
    technique: VignetteTechnique.DEFAULT,
    offset: 0.1,
    darkness: 1.1,
  },
  setVignette: (props: Partial<Vignette>) =>
    set((state) => ({ ...state, vignette: { ...state.vignette, ...props } })),

  outline: {
    enabled: false,
    selectionLayer: 0,
    blendFunction: BlendFunction.ADD,
    patternTexture: null,
    edgeStrength: 2.5,
    pulseSpeed: 0,
    visibleEdgeColor: "#ffffff",
    hiddenEdgeColor: "#22090a",
    kernelSize: KernelSize.VERY_SMALL,
    blur: false,
    xRay: true,
    multisampling: 0,
    resolutionScale: 1,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
  },
  setOutline: (props: Partial<Outline>) =>
    set((state) => ({ ...state, outline: { ...state.outline, ...props } })),

  ascii: {
    enabled: false,
    font: "arial",
    characters: ` .:,'-^=*+?!|0#X%WM@`,
    fontSize: 54,
    cellSize: 16,
    color: "#ffffff",
    invert: false,
    blendFunction: BlendFunction.ADD,
  },
  setAscii: (props: Partial<ASCII>) =>
    set((state) => ({ ...state, ascii: { ...state.ascii, ...props } })),

  brightnessContrast: {
    enabled: false,
    brightness: 0.5,
    contrast: 0.5,
    blendFunction: BlendFunction.ADD,
  },
  setBrightnessContrast: (props: Partial<BrightnessContrast>) =>
    set((state) => ({
      ...state,
      brightnessContrast: { ...state.brightnessContrast, ...props },
    })),

  chromaticAberration: {
    enabled: false,
    radialModulation: false,
    modulationOffset: 0.5,
    offset: [0.01, 0.01],
    blendFunction: BlendFunction.ADD,
  },
  setChromaticAberration: (props: Partial<ChromaticAberration>) =>
    set((state) => ({
      ...state,
      chromaticAberration: { ...state.chromaticAberration, ...props },
    })),

  colorAverage: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
  },
  setColorAverage: (props: Partial<ColorAverage>) =>
    set((state) => ({
      ...state,
      colorAverage: { ...state.colorAverage, ...props },
    })),

  colorDepth: {
    enabled: false,
    bits: 1,
    blendFunction: BlendFunction.ADD,
  },
  setColorDepth: (props: Partial<ColorDepth>) =>
    set((state) => ({
      ...state,
      colorDepth: { ...state.colorDepth, ...props },
    })),

  depth: {
    enabled: false,
    inverted: false,
    blendFunction: BlendFunction.ADD,
  },
  setDepth: (props: Partial<Depth>) =>
    set((state) => ({
      ...state,
      depth: { ...state.depth, ...props },
    })),

  tiltShift: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    offset: 0.0,
    rotation: 0.0,
    focusArea: 0.4,
    feather: 0.3,
    kernelSize: KernelSize.MEDIUM,
    resolutionScale: 0.5,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
  },
  setTiltShift: (props: Partial<TiltShift>) =>
    set((state) => ({
      ...state,
      tiltShift: { ...state.tiltShift, ...props },
    })),

  tiltShift2: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    blur: 0.15,
    taper: 0.5,
    start: [0.5, 0.0],
    end: [0.5, 1.0],
    samples: 10,
    direction: [1, 1],
  },
  setTiltShift2: (props: Partial<TiltShift2>) =>
    set((state) => ({
      ...state,
      tiltShift2: { ...state.tiltShift2, ...props },
    })),

  dotScreen: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    angle: 0.5,
    scale: 1,
  },
  setDotScreen: (props: Partial<DotScreen>) =>
    set((state) => ({
      ...state,
      dotScreen: { ...state.dotScreen, ...props },
    })),

  hueSaturation: {
    enabled: false,
    hue: 0,
    saturation: 0,
    blendFunction: BlendFunction.ADD,
  },
  setHueSaturation: (props: Partial<HueSaturation>) =>
    set((state) => ({
      ...state,
      hueSaturation: { ...state.hueSaturation, ...props },
    })),

  scanline: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    density: 0.5,
  },
  setScanline: (props: Partial<Scanline>) =>
    set((state) => ({
      ...state,
      scanline: { ...state.scanline, ...props },
    })),

  sepia: {
    enabled: false,
    intensity: 0.5,
    blendFunction: BlendFunction.ADD,
  },
  setSepia: (props: Partial<Sepia>) =>
    set((state) => ({
      ...state,
      sepia: { ...state.sepia, ...props },
    })),
}));
