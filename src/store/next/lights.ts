import { create } from "zustand";
import type { LightComponent } from "@/types/ecs";
import { inspector } from "../../../devtools/inspector-middleware";

export const LIGHT_DEFAULTS: Record<string, LightComponent> = {
  ambient: {
    type: "ambient",
    color: "#ffffff",
    intensity: 0.5,
  },
  directional: {
    type: "directional",
    color: "#ffffff",
    intensity: 1,
    castShadow: true,
    shadowMapSize: 2048,
    shadowBias: -0.0001,
  },
  point: {
    type: "point",
    color: "#ffffff",
    intensity: 1,
    distance: 10,
    decay: 0,
    castShadow: true,
    power: 10,
  },
  spot: {
    type: "spot",
    color: "#ffffff",
    intensity: 1,
    distance: 10,
    angle: 60,
    penumbra: 0.1,
    decay: 0,
    castShadow: true,
    power: 10.0,
  },
  hemisphere: {
    type: "hemisphere",
    skyColor: "#ffffff",
    groundColor: "#444444",
    intensity: 0.6,
  },
};

interface LightsState {
  lights: Record<string, LightComponent>;
}

interface LightsActions {
  initLight: (uuid: string, type: LightComponent["type"]) => void;
  setLight: (uuid: string, props: Partial<LightComponent>) => void;
  removeLight: (uuid: string) => void;
  hydrate: (lights: Record<string, LightComponent>) => void;
}

export const useLightsStore = create<LightsState & LightsActions>()(
  inspector(
    (set) => ({
      lights: {},

      initLight: (uuid, type) =>
        set((state) => ({
          lights: {
            ...state.lights,
            [uuid]: { ...LIGHT_DEFAULTS[type] },
          },
        })),

      setLight: (uuid, props) =>
        set((state) => ({
          lights: {
            ...state.lights,
            [uuid]: { ...state.lights[uuid], ...props } as LightComponent,
          },
        })),

      removeLight: (uuid) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...rest } = state.lights;
          return { lights: rest };
        }),

      hydrate: (lights) => set({ lights }),
    }),
    { name: "Lights" },
  ),
);

export const useLight = (uuid?: string) =>
  useLightsStore((state) => (uuid ? state.lights[uuid] : undefined));
