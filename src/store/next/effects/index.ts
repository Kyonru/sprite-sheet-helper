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
import { inspector } from "@kyonru/zustand-inspector";
import type { SnapshotEnabledStore } from "@/types/ecs";
import { createMergeKey } from "../history/utils";
import { withHistory } from "../../common/middlewares/history";
import type { EffectComponent, EffectType } from "@/types/effects";
import { isEqual } from "@/utils/object";
import {
  EFFECT_PRESETS,
  type EffectPresetId,
} from "@/constants/effects";
import { normalizeEffectOrder } from "@/utils/effects";

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
    visibleEdgeColor: "#111111",
    hiddenEdgeColor: "#111111",
    kernelSize: KernelSize.VERY_SMALL,
    blur: false,
    xRay: false,
    multisampling: 0,
    resolutionScale: 0.5,
    resolutionX: Resolution.AUTO_SIZE,
    resolutionY: Resolution.AUTO_SIZE,
  },
  edgeOutline: {
    enabled: true,
    color: "#111111",
    strength: 3,
    thickness: 1,
    threshold: 0.18,
    opacity: 1,
  },
  silhouetteOutline: {
    enabled: true,
    color: "#111111",
    thickness: 2,
    opacity: 1,
    alphaThreshold: 0.01,
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
  order: string[];
  selected?: string;
}

interface EffectsActions extends SnapshotEnabledStore<EffectsState> {
  initEffect: (
    type: EffectType,
    props?: Partial<EffectComponent>,
    preferredUuid?: string,
  ) => string;
  setEffect: (uuid: string, props: Partial<EffectComponent>) => void;
  setSelected: (uuid?: string) => void;
  removeEffect: (uuid: string) => void;
  reorderEffects: (order: string[]) => void;
  duplicateEffect: (uuid: string) => void;
  clearEffects: () => void;
  applyEffectsPreset: (
    presetId: EffectPresetId,
    mode: "append" | "replace",
  ) => void;
}

const initialState: EffectsState = {
  effects: {},
  order: [],
  selected: undefined,
};

interface EffectsStore extends EffectsState, EffectsActions {}

function createEffectComponent(
  type: EffectType,
  props: Partial<EffectComponent> = {},
): EffectComponent {
  return { type, ...EFFECT_DEFAULTS[type], ...props } as EffectComponent;
}

function cloneEffectComponent(effect: EffectComponent): EffectComponent {
  return JSON.parse(JSON.stringify(effect)) as EffectComponent;
}

function normalizeSelected(
  effects: Record<string, EffectComponent>,
  order: string[],
  selected?: string,
): string | undefined {
  if (selected && effects[selected]) return selected;
  return order[0];
}

export const useEffectsStore = create<EffectsStore>()(
  inspector(
    withHistory(
      (set, get) => ({
        ...initialState,

        initEffect: (type, props, preferredUuid) => {
          const uuid = preferredUuid ?? generateUUID();
          set((state) => {
            const effects = {
              ...state.effects,
              [uuid]: createEffectComponent(type, props),
            };
            const order = normalizeEffectOrder(effects, [
              ...state.order,
              uuid,
            ]);

            return {
              effects,
              order,
              selected: uuid,
            };
          });
          return uuid;
        },

        setSelected: (uuid) =>
          set((state) => ({
            selected: uuid && state.effects[uuid] ? uuid : undefined,
          })),

        setEffect: (uuid, props) =>
          set((state) => {
            const effect = state.effects[uuid];
            if (!effect) return state;
            return {
              effects: {
                ...state.effects,
                [uuid]: { ...effect, ...props } as EffectComponent,
              },
            };
          }),

        removeEffect: (uuid) =>
          set((state) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: _, ...effects } = state.effects;
            const order = normalizeEffectOrder(
              effects,
              state.order.filter((id) => id !== uuid),
            );
            return {
              effects,
              order,
              selected: normalizeSelected(effects, order, state.selected),
            };
          }),

        reorderEffects: (order) =>
          set((state) => ({
            order: normalizeEffectOrder(state.effects, order),
          })),

        duplicateEffect: (uuid) =>
          set((state) => {
            const effect = state.effects[uuid];
            if (!effect) return state;

            const nextUuid = generateUUID();
            const effects = {
              ...state.effects,
              [nextUuid]: cloneEffectComponent(effect),
            };
            const currentOrder = normalizeEffectOrder(
              state.effects,
              state.order,
            );
            const sourceIndex = currentOrder.indexOf(uuid);
            const order =
              sourceIndex === -1
                ? [...currentOrder, nextUuid]
                : [
                    ...currentOrder.slice(0, sourceIndex + 1),
                    nextUuid,
                    ...currentOrder.slice(sourceIndex + 1),
                  ];

            return {
              effects,
              order: normalizeEffectOrder(effects, order),
              selected: nextUuid,
            };
          }),

        clearEffects: () =>
          set(() => ({
            effects: {},
            order: [],
            selected: undefined,
          })),

        applyEffectsPreset: (presetId, mode) =>
          set((state) => {
            const preset = EFFECT_PRESETS[presetId];
            const baseEffects = mode === "replace" ? {} : state.effects;
            const baseOrder =
              mode === "replace"
                ? []
                : normalizeEffectOrder(state.effects, state.order);
            const effects = { ...baseEffects };
            const addedIds: string[] = [];

            for (const entry of preset.effects) {
              const uuid = generateUUID();
              effects[uuid] = createEffectComponent(entry.type, entry.props);
              addedIds.push(uuid);
            }

            const order = normalizeEffectOrder(effects, [
              ...baseOrder,
              ...addedIds,
            ]);

            return {
              effects,
              order,
              selected: addedIds.at(-1) ?? normalizeSelected(effects, order),
            };
          }),

        reset: () => set({ ...initialState }),

        hydrate: (snapshot) => {
          const effects = snapshot.effects ?? {};
          const order = normalizeEffectOrder(effects, snapshot.order);
          set({
            effects: {
              ...effects,
            },
            order,
            selected: normalizeSelected(effects, order, snapshot.selected),
          });
        },

        getSnapshot: () => {
          const effects = get().effects;
          const order = normalizeEffectOrder(effects, get().order);
          return {
            effects,
            order,
            selected: normalizeSelected(effects, order, get().selected),
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
    { name: "Effects", enabled: import.meta.env.DEV },
  ),
);
