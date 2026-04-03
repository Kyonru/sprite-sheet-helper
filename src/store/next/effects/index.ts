import { generateUUID } from "@/utils/strings";
import {
  GlitchMode,
  BlendFunction,
  KernelSize,
  Resolution,
  VignetteTechnique,
  ToneMappingMode,
  SMAAPreset,
  EdgeDetectionMode,
  PredicationMode,
} from "postprocessing";
import { create } from "zustand";
import { inspector } from "../../../../devtools/inspector-middleware";
import type { SnapshotEnabledStore } from "@/types/ecs";

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
  | "fxaa";

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
);

type EffectDefaults = {
  [K in EffectType]: Omit<Extract<EffectComponent, { type: K }>, "type">;
};

export const EFFECT_DEFAULTS: EffectDefaults = {
  grid: {
    enabled: true,
    scale: 1,
    lineWidth: 0.01,
    blendFunction: BlendFunction.OVERLAY,
  },
  pixelation: { enabled: true, granularity: 2 },
  glitch: {
    enabled: true,
    delay: [0, 0],
    duration: [0.1, 0.1],
    strength: [0.3, 0.3],
    chromaticAberrationOffset: [0, 0],
    dtSize: 64,
    columns: 0.05,
    mode: GlitchMode.SPORADIC,
    ratio: 0.85,
  },
  bloom: {
    enabled: true,
    blendFunction: BlendFunction.SCREEN,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.03,
    intensity: 1.0,
    mipmapBlur: true,
    levels: 8,
    radius: 0.85,
  },
  depthOfField: {
    enabled: true,
    blendFunction: BlendFunction.NORMAL,
    focusDistance: 3.0,
    focusRange: 2.0,
    worldFocusDistance: 0,
    worldFocusRange: 0,
    bokehScale: 1,
    resolutionScale: 0.5,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
  },
  noise: {
    enabled: true,
    premultiply: false,
    blendFunction: BlendFunction.SCREEN,
  },
  vignette: {
    enabled: true,
    technique: VignetteTechnique.DEFAULT,
    offset: 0.5,
    darkness: 0.5,
  },
  outline: {
    enabled: true,
    blendFunction: BlendFunction.SCREEN,
    edgeStrength: 1,
    pulseSpeed: 0,
    visibleEdgeColor: "#ffffff",
    hiddenEdgeColor: "#22090a",
    kernelSize: KernelSize.VERY_SMALL,
    blur: false,
    xRay: true,
    multisampling: 0,
    resolutionScale: 0.5,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
  },
  ascii: {
    enabled: true,
    font: "arial",
    characters: ` .:,'-^=*+?!|0#X%WM@`,
    fontSize: 54,
    cellSize: 16,
    color: "#ffffff",
    invert: false,
    blendFunction: BlendFunction.NORMAL,
  },
  brightnessContrast: {
    enabled: true,
    brightness: 0,
    contrast: 0,
    blendFunction: BlendFunction.SRC,
  },
  chromaticAberration: {
    enabled: true,
    radialModulation: false,
    modulationOffset: 0.15,
    offset: [0.01, 0.01],
    blendFunction: BlendFunction.NORMAL,
  },
  colorAverage: { enabled: true, blendFunction: BlendFunction.NORMAL },
  colorDepth: { enabled: true, bits: 16, blendFunction: BlendFunction.NORMAL },
  depth: { enabled: true, inverted: false, blendFunction: BlendFunction.SRC },
  tiltShift: {
    enabled: true,
    blendFunction: BlendFunction.ADD,
    offset: 0,
    rotation: 0,
    focusArea: 0.4,
    feather: 0.3,
    kernelSize: KernelSize.MEDIUM,
    resolutionScale: 0.5,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
  },
  tiltShift2: {
    enabled: true,
    blendFunction: BlendFunction.ADD,
    blur: 0.15,
    taper: 0.5,
    start: [0.5, 0.0],
    end: [0.5, 1.0],
    samples: 10,
    direction: [1, 1],
  },
  dotScreen: {
    enabled: true,
    blendFunction: BlendFunction.NORMAL,
    angle: 1.57,
    scale: 1,
  },
  hueSaturation: {
    enabled: true,
    hue: 0,
    saturation: 0,
    blendFunction: BlendFunction.SRC,
  },
  scanline: {
    enabled: true,
    blendFunction: BlendFunction.ADD,
    density: 0.5,
    scrollSpeed: 0,
  },
  sepia: { enabled: true, intensity: 1, blendFunction: BlendFunction.ADD },
  palette: { enabled: true, palette: 0 },
  dither: { enabled: true, ditherStrength: 0.5, ditherScale: 1.0 },
  tonemap: {
    enabled: true,
    blendFunction: BlendFunction.SRC,
    mode: ToneMappingMode.AGX,
    adaptive: false,
    resolution: 256,
    maxLuminance: 4.0,
    whitePoint: 4.0,
    middleGrey: 0.6,
    minLuminance: 0.01,
    averageLuminance: 1.0,
    adaptationRate: 1.0,
  },
  customShader: {
    enabled: true,
    fragmentShader: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = inputColor;
}`,
  },
  shockwave: {
    enabled: true,
    blendFunction: BlendFunction.NORMAL,
    speed: 2.0,
    position: [0, 0, 0],
    maxRadius: 1,
    wavelength: 0.2,
    amplitude: 0.05,
  },
  ssao: {
    enabled: true,
    blendFunction: BlendFunction.NORMAL,
    depthAwareUpsampling: true,
    samples: 9,
    rings: 7,
    worldDistanceThreshold: 0.01,
    worldDistanceFalloff: 0.0,
    worldProximityThreshold: 0.01,
    worldProximityFalloff: 0.0,
    minRadiusScale: 0.1,
    luminanceInfluence: 0.7,
    radius: 0.1825,
    intensity: 1.0,
    bias: 0.025,
    fade: 0.01,
    color: "#ffffff",
    resolutionScale: 1.0,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
  },
  smaa: {
    enabled: true,
    blendFunction: BlendFunction.SRC,
    preset: SMAAPreset.MEDIUM,
    edgeDetectionMode: EdgeDetectionMode.COLOR,
    predicationMode: PredicationMode.DISABLED,
  },
  gammaCorrection: {
    enabled: true,
    blendFunction: BlendFunction.SRC,
    gamma: 2.0,
  },
  fxaa: {
    enabled: true,
    blendFunction: BlendFunction.SRC,
  },
  bokeh: {
    enabled: true,
    blendFunction: BlendFunction.ADD,
    focus: 0.5,
    dof: 0.02,
    aperture: 0.015,
    maxBlur: 1.0,
  },
};

export interface EffectsState {
  effects: Record<string, EffectComponent>;
  selected?: string;
}

interface EffectsActions extends SnapshotEnabledStore<EffectsState> {
  initEffect: (type: EffectType) => void;
  setEffect: (uuid: string, props: Partial<EffectComponent>) => void;
  setSelected: (uuid?: string) => void;
  removeEffect: (uuid: string) => void;
}

interface EffectsStore extends EffectsState, EffectsActions {}

export const useEffectsStore = create<EffectsStore>()(
  inspector(
    (set, get) => ({
      effects: {},
      selected: undefined,

      initEffect: (type) => {
        const uuid = generateUUID();
        return set((state) => ({
          effects: {
            ...state.effects,
            [uuid]: { type, ...EFFECT_DEFAULTS[type] } as EffectComponent,
          },
          selected: uuid,
        }));
      },

      setSelected: (uuid) => set(() => ({ selected: uuid })),

      setEffect: (uuid, props) =>
        set((state) => ({
          effects: {
            ...state.effects,
            [uuid]: { ...state.effects[uuid], ...props } as EffectComponent,
          },
        })),

      removeEffect: (uuid) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...rest } = state.effects;
          return { effects: rest };
        }),

      hydrate: (snapshot) =>
        set({
          effects: snapshot.effects,
          selected: snapshot.selected,
        }),

      getSnapshot: () => {
        return {
          effects: get().effects,
          selected: get().selected,
        };
      },
    }),
    { name: "Effects" },
  ),
);

export const useEffect = (uuid?: string) =>
  useEffectsStore((state) => (uuid ? state.effects[uuid] : undefined));
