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
import { createMergeKey } from "../history/utils";
import { withHistory } from "../../common/middlewares/history";
import type { EffectComponent, EffectType } from "@/types/effects";
import { isEqual } from "@/utils/object";

type EffectDefaults = {
  [K in EffectType]: Omit<Extract<EffectComponent, { type: K }>, "type">;
};

const EFFECT_DEFAULTS: EffectDefaults = {
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
  smear: {
    enabled: true,
    damp: 0.85,
    tint: "#ffffff",
    legacy: false,
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

const initialState: EffectsState = {
  effects: {},
  selected: undefined,
};

interface EffectsStore extends EffectsState, EffectsActions {}

export const useEffectsStore = create<EffectsStore>()(
  inspector(
    withHistory(
      (set, get) => ({
        ...initialState,

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

        reset: () => set(initialState),

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
      {
        name: "Effects",
        watchers: [
          {
            select: (state) => state.effects,
            toAction: (prev, next, api) => {
              const prevKeys = new Set(Object.keys(prev.effects));
              const nextKeys = new Set(Object.keys(next.effects));

              // Init
              for (const uuid of nextKeys) {
                if (!prevKeys.has(uuid)) {
                  return {
                    type: "effect/init",
                    uuid,
                    to: next.effects[uuid],
                    from: null,
                    apply: ({ dir, value }) => {
                      if (dir === "forward") {
                        api.getState().setEffect(uuid, value);
                      } else {
                        api.getState().removeEffect(uuid);
                      }
                    },
                  };
                }
              }

              // Remove
              for (const uuid of prevKeys) {
                if (!nextKeys.has(uuid)) {
                  return {
                    type: "effect/remove",
                    uuid,
                    from: prev.effects[uuid],
                    to: null,
                    apply: ({ dir, value }) => {
                      if (dir === "forward") {
                        api.getState().removeEffect(uuid);
                      } else {
                        api.getState().initEffect(value.type);
                      }
                    },
                  };
                }
              }

              // Change
              for (const uuid of nextKeys) {
                if (prev.effects[uuid] !== next.effects[uuid]) {
                  const existedBefore = prevKeys.has(uuid);

                  if (isEqual(prev.effects[uuid], next.effects[uuid]))
                    return null;

                  if (!existedBefore) continue;
                  return {
                    type: "effect/edit",
                    uuid,
                    from: prev.effects[uuid],
                    to: next.effects[uuid],
                    apply: ({ value }) => {
                      api.getState().setEffect(uuid, value);
                    },
                  };
                }
              }

              return null;
            },
            mergeKey: (prev, next) => {
              for (const uuid of Object.keys(next.effects)) {
                if (!prev.effects[uuid]) continue;

                if (prev.effects[uuid] !== next.effects[uuid]) {
                  return createMergeKey("effect", uuid, "edit");
                }
              }
              return undefined;
            },
          },
        ],
      },
    ),
    { name: "Effects" },
  ),
);
