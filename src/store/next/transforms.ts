import type { SnapshotEnabledStore, Transform } from "@/types/ecs";
import type { Transform as TransformMode } from "@/types/transform";
import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";

const DEFAULT_TRANSFORM: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

export interface TransformsState {
  transforms: Record<string, Transform>;
  mode: TransformMode;
}

interface TransformsActions extends SnapshotEnabledStore<TransformsState> {
  setTransform: (uuid: string, transform: Partial<Transform>) => void;
  initTransform: (uuid: string, transform?: Partial<Transform>) => void;
  removeTransform: (uuid: string) => void;
  setMode: (mode: TransformMode) => void;
}

export const useTransformsStore = create<TransformsState & TransformsActions>()(
  inspector(
    (set, get) => ({
      transforms: {},
      mode: "translate",

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
    },
  ),
);

export const useTransform = (uuid?: string) =>
  useTransformsStore((state) => (uuid ? state.transforms[uuid] : undefined));
