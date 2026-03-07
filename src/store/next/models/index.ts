import { create } from "zustand";
import { inspector } from "../../../../devtools/inspector-middleware";
import type { ModelComponent, ModelLoadState } from "@/types/ecs";
import * as THREE from "three";
import { saveFileToOPFS } from "@/utils/fs";
import { toast } from "sonner";

const modelCache = new Map<string, THREE.Object3D>();
const mixerCache = new Map<string, THREE.AnimationMixer>();
const clipsCache = new Map<
  string,
  { action: THREE.AnimationAction; clip: THREE.AnimationClip }[]
>();

export const getModelFromCache = (uuid: string) => modelCache.get(uuid) ?? null;
export const getMixerFromCache = (uuid: string) => mixerCache.get(uuid) ?? null;
export const getClipsFromCache = (uuid: string) => clipsCache.get(uuid) ?? [];

type SerializableModel = Omit<ModelComponent, "loadState" | "errorMessage">;

interface ModelsState {
  models: Record<string, ModelComponent>;
  clips: Record<string, THREE.AnimationClip[]>;
}

interface ModelsActions {
  loadFromFile: (uuid: string, file: File) => Promise<void>;
  reloadModel: (uuid: string) => Promise<void>;
  removeModel: (uuid: string) => void;
  setClips: (uuid: string, clips: THREE.AnimationClip[]) => void;
  setLoadState: (
    uuid: string,
    loadState: ModelLoadState,
    errorMessage?: string | null,
  ) => void;
  hydrate: (models: Record<string, SerializableModel>) => void;
}

export const useModelsStore = create<ModelsState & ModelsActions>()(
  inspector(
    (set, get) => ({
      models: {},
      clips: {},

      setLoadState: (uuid, loadState, errorMessage = "") =>
        set((state) => ({
          models: {
            ...state.models,
            [uuid]: { ...state.models[uuid], loadState, errorMessage },
          },
        })),

      loadFromFile: async (uuid, file) => {
        const { setLoadState } = get();
        const format = file.name
          .split(".")
          .pop()
          ?.toLowerCase() as ModelComponent["format"];

        const opfsFileName = await saveFileToOPFS(uuid, file, "models");

        set((state) => ({
          models: {
            ...state.models,
            [uuid]: {
              file: file,
              fileName: file.name,
              filePath: opfsFileName,
              type: file.type,
              fileSize: file.size,
              format,
              loadState: "loading",
              errorMessage: null,
            },
          },
        }));

        try {
          setLoadState(uuid, "loaded");
        } catch (e) {
          toast.error((e as Error).message);
          setLoadState(uuid, "error", (e as Error).message);
        }
      },

      reloadModel: async (uuid) => {
        const { models, setLoadState } = get();
        const model = models[uuid];
        if (!model) return;

        setLoadState(uuid, "loading");

        try {
          setLoadState(uuid, "loaded");
        } catch (e) {
          setLoadState(uuid, "error", (e as Error).message);
        }
      },

      removeModel: (uuid) => {
        const { setClips } = get();
        const model = get().models[uuid];
        if (!model) return;
        mixerCache.get(uuid)?.stopAllAction();
        modelCache.delete(uuid);
        mixerCache.delete(uuid);
        clipsCache.delete(uuid);
        setClips(uuid, []);

        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...rest } = state.models;
          return { models: rest };
        });
      },

      setClips: (uuid, clips) =>
        set((state) => ({ clips: { ...state.clips, [uuid]: clips } })),

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

    { name: "Models" },
  ),
);

export const useModel = (uuid: string) =>
  useModelsStore((state) => state.models[uuid] ?? null);

export const useModelObject = (uuid: string) => getModelFromCache(uuid);
export const useModelMixer = (uuid: string) => getMixerFromCache(uuid);
export const useModelClips = (uuid: string) => getClipsFromCache(uuid);
