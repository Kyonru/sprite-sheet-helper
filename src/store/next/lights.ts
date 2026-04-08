import { create } from "zustand";
import type { LightComponent, SnapshotEnabledStore } from "@/types/ecs";
import { inspector } from "../../../devtools/inspector-middleware";
import { withHistory } from "../common/middlewares/history";
import { createMergeKey } from "./history/utils";
import { isEqual } from "@/utils/object";

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

export interface LightsState {
  lights: Record<string, LightComponent>;
}

interface LightsActions extends SnapshotEnabledStore<LightsState> {
  initLight: (
    uuid: string,
    type: LightComponent["type"],
    props?: Omit<Partial<LightComponent>, "type">,
  ) => void;
  setLight: (uuid: string, props: Partial<LightComponent>) => void;
  removeLight: (uuid: string) => void;
}

export const useLightsStore = create<LightsState & LightsActions>()(
  inspector(
    withHistory(
      (set, get) => ({
        lights: {},

        initLight: (uuid, type, props = {}) =>
          set((state) => ({
            lights: {
              ...state.lights,
              [uuid]: { ...LIGHT_DEFAULTS[type], ...props },
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

        getSnapshot: () => {
          return {
            lights: get().lights,
          };
        },

        hydrate: (snapshot) =>
          set({
            lights: snapshot.lights,
          }),
      }),
      {
        name: "Lights",
        watchers: [
          {
            select: (state) => state.lights,
            toAction: (prev, next, api) => {
              const prevKeys = new Set(Object.keys(prev.lights));
              const nextKeys = new Set(Object.keys(next.lights));

              // Init
              for (const uuid of nextKeys) {
                if (!prevKeys.has(uuid)) {
                  // Since light is init in batch, we don't need to init it here
                  return null;
                }
              }

              // Remove
              for (const uuid of prevKeys) {
                if (!nextKeys.has(uuid)) {
                  return {
                    type: "light/remove",
                    uuid,
                    from: prev.lights[uuid],
                    to: null,
                    apply: ({ dir, value }) => {
                      if (dir === "forward") {
                        api.getState().removeLight(uuid);
                      } else {
                        api.getState().initLight(uuid, value.type, value);
                      }
                    },
                  };
                }
              }

              // Change
              for (const uuid of nextKeys) {
                if (prev.lights[uuid] !== next.lights[uuid]) {
                  if (isEqual(prev.lights[uuid], next.lights[uuid]))
                    return null;

                  return {
                    type: "light/edit",
                    uuid,
                    from: prev.lights[uuid],
                    to: next.lights[uuid],
                    apply: ({ value }) => {
                      api.getState().setLight(uuid, value);
                    },
                  };
                }
              }

              return null;
            },
            mergeKey: (prev, next) => {
              for (const uuid of Object.keys(next.lights)) {
                if (prev.lights[uuid] !== next.lights[uuid]) {
                  return createMergeKey("light", uuid, "edit");
                }
              }
              return undefined;
            },
          },
        ],
      },
    ),
    { name: "Lights" },
  ),
);

export const useLight = (uuid?: string) =>
  useLightsStore((state) => (uuid ? state.lights[uuid] : undefined));
