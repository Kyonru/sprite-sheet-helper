import type { SnapshotEnabledStore, Transform } from "@/types/ecs";
import type { Transform as TransformMode } from "@/types/transform";
import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";
import { createMergeKey } from "./history/utils";
import { withHistory } from "../common/middlewares/history";
import { isEqual } from "@/utils/object";

const DEFAULT_TRANSFORM: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

export interface TransformsState {
  transforms: Record<string, Transform>;
  mode: TransformMode;
}

const initialState: TransformsState = {
  transforms: {},
  mode: "translate",
};

interface TransformsActions extends SnapshotEnabledStore<TransformsState> {
  setTransform: (uuid: string, transform: Partial<Transform>) => void;
  initTransform: (uuid: string, transform?: Partial<Transform>) => void;
  removeTransform: (uuid: string) => void;
  setMode: (mode: TransformMode) => void;
}

export const useTransformsStore = create<TransformsState & TransformsActions>()(
  inspector(
    withHistory(
      (set, get) => ({
        ...initialState,

        initTransform: (uuid, transform = {}) =>
          set((state) => ({
            transforms: {
              ...state.transforms,
              [uuid]: { ...DEFAULT_TRANSFORM, ...transform },
            },
          })),

        setTransform: (uuid, transform) =>
          set((state) => ({
            transforms: {
              ...state.transforms,
              [uuid]: { ...state.transforms[uuid], ...transform },
            },
          })),

        removeTransform: (uuid) =>
          set((state) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: _, ...rest } = state.transforms;
            return { transforms: rest };
          }),

        setMode: (mode) => set({ mode }),

        reset: () => set(initialState),

        hydrate: (snapshot) =>
          set({
            transforms: snapshot.transforms,
            mode: snapshot.mode,
          }),

        getSnapshot: () => {
          return {
            transforms: get().transforms,
            mode: get().mode,
          };
        },
      }),
      {
        name: "Transforms",
        watchers: [
          {
            select: (state) => state.transforms,

            toAction: (prev, next, api) => {
              const prevKeys = new Set(Object.keys(prev.transforms));
              const nextKeys = new Set(Object.keys(next.transforms));

              // Init
              for (const uuid of nextKeys) {
                if (!prevKeys.has(uuid)) {
                  return null;
                }
              }

              // Remove
              for (const uuid of prevKeys) {
                if (!nextKeys.has(uuid)) {
                  return {
                    type: "transform/remove",
                    uuid,
                    from: prev.transforms[uuid],
                    to: null,
                    apply: ({ dir, value }) => {
                      if (dir === "forward") {
                        api.getState().removeTransform(uuid);
                      } else {
                        api.getState().initTransform(uuid, value);
                      }
                    },
                  };
                }
              }

              // Edit
              for (const uuid of nextKeys) {
                const p = prev.transforms[uuid];
                const n = next.transforms[uuid];

                if (p !== n) {
                  if (isEqual(p, n)) return null;

                  return {
                    type: "transform/edit",
                    uuid,
                    from: p,
                    to: n,

                    apply: ({ value }) => {
                      api.getState().setTransform(uuid, value);
                    },
                  };
                }
              }

              return null;
            },

            mergeKey: (prev, next) => {
              for (const uuid of Object.keys(next.transforms)) {
                const p = prev.transforms[uuid];
                const n = next.transforms[uuid];

                if (p !== n) {
                  return createMergeKey("transform", uuid, "edit");
                }
              }

              return undefined;
            },
          },
          {
            select: (state) => state.mode,

            toAction: (prev, next, api) => {
              if (prev.mode !== next.mode) {
                return {
                  type: "transform/mode",
                  uuid: "mode",
                  from: prev.mode,
                  to: next.mode,

                  apply: ({ value }) => {
                    api.getState().setMode(value);
                  },
                };
              }

              return null;
            },

            mergeKey: () => "transform:mode",
          },
        ],
      },
    ),
    { name: "Transforms" },
  ),
);

export const useTransform = (uuid?: string) =>
  useTransformsStore((state) => (uuid ? state.transforms[uuid] : undefined));
