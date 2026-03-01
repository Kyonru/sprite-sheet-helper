import type { Transform } from "@/types/ecs";
import { create } from "zustand";

const DEFAULT_TRANSFORM: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

interface TransformsState {
  transforms: Record<string, Transform>;
}

interface TransformsActions {
  setTransform: (uuid: string, transform: Partial<Transform>) => void;
  initTransform: (uuid: string, transform?: Partial<Transform>) => void;
  removeTransform: (uuid: string) => void;
  hydrate: (transforms: Record<string, Transform>) => void;
}

export const useTransformsStore = create<TransformsState & TransformsActions>(
  (set) => ({
    transforms: {},

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

    hydrate: (transforms) => set({ transforms }),
  }),
);

export const useTransform = (uuid: string) =>
  useTransformsStore((state) => state.transforms[uuid] ?? DEFAULT_TRANSFORM);
