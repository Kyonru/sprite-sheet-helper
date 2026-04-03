import { generateUUID } from "@/utils/strings";
import {
  GlitchMode,
  BlendFunction,
  KernelSize,
  Resolution,
  VignetteTechnique,
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
  | "customShader";

export type EffectComponent = { type: EffectType; enabled: boolean } & (
  | { type: "pixelation"; granularity: number }
  | {
      type: "glitch";
      blendFunction: BlendFunction;
      delay: number;
      duration: number;
      strength: number;
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
      resolutionX: number;
      resolutionY: number;
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
      selectionLayer: number;
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
  | { type: "scanline"; blendFunction: BlendFunction; density: number }
  | { type: "sepia"; intensity: number; blendFunction: BlendFunction }
  | { type: "palette"; palette: number }
  | { type: "dither"; ditherStrength: number; ditherScale: number }
  | {
      type: "tonemap";
      blendFunction: BlendFunction;
      adaptive: boolean;
      resolution: number;
      middleGrey: number;
      maxLuminance: number;
      averageLuminance: number;
      adaptationRate: number;
    }
  | { type: "customShader"; fragmentShader: string }
);

type EffectDefaults = {
  [K in EffectType]: Omit<Extract<EffectComponent, { type: K }>, "type">;
};

export const EFFECT_DEFAULTS: EffectDefaults = {
  pixelation: { enabled: false, granularity: 2 },
  glitch: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    delay: 1.5,
    duration: 0.6,
    strength: 0.3,
    chromaticAberrationOffset: [0, 0],
    dtSize: 64,
    columns: 0.05,
    mode: GlitchMode.SPORADIC,
    ratio: 0.85,
  },
  bloom: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    luminanceThreshold: 0.025,
    luminanceSmoothing: 0.9,
    intensity: 1.0,
    mipmapBlur: false,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
    levels: 1,
    radius: 0.5,
  },
  depthOfField: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    focusDistance: 0,
    focusRange: 0.1,
    worldFocusDistance: 0,
    worldFocusRange: 0,
    bokehScale: 1,
    resolutionScale: 1,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
  },
  noise: {
    enabled: false,
    premultiply: false,
    blendFunction: BlendFunction.ADD,
  },
  vignette: {
    enabled: false,
    technique: VignetteTechnique.DEFAULT,
    offset: 0.1,
    darkness: 1.1,
  },
  outline: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    selectionLayer: 0,
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
  brightnessContrast: {
    enabled: false,
    brightness: 0.5,
    contrast: 0.5,
    blendFunction: BlendFunction.ADD,
  },
  chromaticAberration: {
    enabled: false,
    radialModulation: false,
    modulationOffset: 0.5,
    offset: [0.01, 0.01],
    blendFunction: BlendFunction.ADD,
  },
  colorAverage: { enabled: false, blendFunction: BlendFunction.ADD },
  colorDepth: { enabled: false, bits: 1, blendFunction: BlendFunction.ADD },
  depth: { enabled: false, inverted: false, blendFunction: BlendFunction.ADD },
  tiltShift: {
    enabled: false,
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
    enabled: false,
    blendFunction: BlendFunction.ADD,
    blur: 0.15,
    taper: 0.5,
    start: [0.5, 0.0],
    end: [0.5, 1.0],
    samples: 10,
    direction: [1, 1],
  },
  dotScreen: {
    enabled: false,
    blendFunction: BlendFunction.ADD,
    angle: 0.5,
    scale: 1,
  },
  hueSaturation: {
    enabled: false,
    hue: 0,
    saturation: 0,
    blendFunction: BlendFunction.ADD,
  },
  scanline: { enabled: false, blendFunction: BlendFunction.ADD, density: 0.5 },
  sepia: { enabled: false, intensity: 0.5, blendFunction: BlendFunction.ADD },
  palette: { enabled: false, palette: 0 },
  dither: { enabled: false, ditherStrength: 0.5, ditherScale: 1.0 },
  tonemap: {
    enabled: false,
    blendFunction: BlendFunction.NORMAL,
    adaptive: true,
    resolution: 256,
    middleGrey: 0.6,
    maxLuminance: 16.0,
    averageLuminance: 1.0,
    adaptationRate: 1.0,
  },
  customShader: {
    enabled: false,
    fragmentShader: `void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = inputColor;
}`,
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
