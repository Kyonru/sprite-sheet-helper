import { create } from "zustand";
import type { MaterialComponent } from "@/types/ecs";

export const DEFAULT_MATERIAL: MaterialComponent = {
  color: "#ffffff",
  opacity: 1,
  transparent: false,
  roughness: 0.5,
  metalness: 0,
  map: null,
  normalMap: null,
  roughnessMap: null,
  metalnessMap: null,
  aoMap: null,
  emissiveMap: null,
  emissive: "#000000",
  emissiveIntensity: 0,
  wireframe: false,
  side: "front",
  depthWrite: true,
};

interface MaterialsState {
  materials: Record<string, MaterialComponent>;
}

interface MaterialsActions {
  initMaterial: (uuid: string, overrides?: Partial<MaterialComponent>) => void;
  setMaterial: (uuid: string, props: Partial<MaterialComponent>) => void;
  removeMaterial: (uuid: string) => void;
  hydrate: (materials: Record<string, MaterialComponent>) => void;
}

export const useMaterialsStore = create<MaterialsState & MaterialsActions>(
  (set) => ({
    materials: {},

    initMaterial: (uuid, overrides = {}) =>
      set((state) => ({
        materials: {
          ...state.materials,
          [uuid]: { ...DEFAULT_MATERIAL, ...overrides },
        },
      })),

    setMaterial: (uuid, props) =>
      set((state) => ({
        materials: {
          ...state.materials,
          [uuid]: { ...state.materials[uuid], ...props },
        },
      })),

    removeMaterial: (uuid) =>
      set((state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [uuid]: _, ...rest } = state.materials;
        return { materials: rest };
      }),

    hydrate: (materials) => set({ materials }),
  }),
);

export const useMaterial = (uuid: string) =>
  useMaterialsStore((state) => state.materials[uuid] ?? DEFAULT_MATERIAL);
