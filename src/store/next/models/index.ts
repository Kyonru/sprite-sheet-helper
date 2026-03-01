import { create } from "zustand";
import type { ModelComponent, ModelLoadState } from "@/types/ecs";
import * as THREE from "three";
import { loadModel } from "./utils";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
// import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
// import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

// Runtime cache — Three.js objects are NOT serializable, kept outside store
const modelCache = new Map<string, THREE.Object3D>();

export const getModelFromCache = (uuid: string) => modelCache.get(uuid) ?? null;

type SerializableModel = Omit<ModelComponent, "loadState" | "errorMessage">;

interface ModelsState {
  models: Record<string, ModelComponent>;
}

interface ModelsActions {
  loadFromFile: (uuid: string, file: File) => Promise<void>;
  reloadModel: (uuid: string) => Promise<void>;
  removeModel: (uuid: string) => void;
  setLoadState: (
    uuid: string,
    loadState: ModelLoadState,
    errorMessage?: string | null,
  ) => void;
  hydrate: (models: Record<string, SerializableModel>) => void; // on load, restore metadata but re-trigger loads
}

export const useModelsStore = create<ModelsState & ModelsActions>(
  (set, get) => ({
    models: {},

    setLoadState: (uuid, loadState, errorMessage = "") =>
      set((state) => ({
        models: {
          ...state.models,
          [uuid]: { ...state.models[uuid], loadState, errorMessage },
        },
      })),

    loadFromFile: async (uuid, file) => {
      const { setLoadState } = get();
      const filePath = URL.createObjectURL(file);
      const format = file.name
        .split(".")
        .pop()
        ?.toLowerCase() as ModelComponent["format"];

      // Register metadata immediately
      set((state) => ({
        models: {
          ...state.models,
          [uuid]: {
            fileName: file.name,
            filePath,
            fileSize: file.size,
            format,
            loadState: "loading",
            errorMessage: null,
          },
        },
      }));

      try {
        const object = await loadModel(filePath, format);
        modelCache.set(uuid, object);
        setLoadState(uuid, "loaded");
      } catch (e) {
        setLoadState(uuid, "error", (e as Error).message);
      }
    },

    reloadModel: async (uuid) => {
      const model = get().models[uuid];
      if (!model) return;

      get().setLoadState(uuid, "loading");

      try {
        const object = await loadModel(model.filePath, model.format);
        modelCache.set(uuid, object);
        get().setLoadState(uuid, "loaded");
      } catch (e) {
        get().setLoadState(uuid, "error", (e as Error).message);
      }
    },

    removeModel: (uuid) => {
      modelCache.delete(uuid);
      set((state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [uuid]: _, ...rest } = state.models;
        return { models: rest };
      });
    },

    // On project load: restore metadata, mark as idle, let components trigger reload
    hydrate: (models) =>
      set({
        models: Object.fromEntries(
          Object.entries(models).map(([uuid, m]) => [
            uuid,
            { ...m, loadState: "idle", errorMessage: null },
          ]),
        ),
      }),
  }),
);

// Selectors
export const useModel = (uuid: string) =>
  useModelsStore((state) => state.models[uuid] ?? null);

export const useModelObject = (uuid: string) => getModelFromCache(uuid);
