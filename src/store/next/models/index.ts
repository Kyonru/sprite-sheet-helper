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

export type LoopType = THREE.AnimationActionLoopStyles;

interface ModelsState {
  models: Record<string, ModelComponent>;
  clips: Record<
    string,
    {
      action: THREE.AnimationAction;
      clip: THREE.AnimationClip;
    }[]
  >;
  mixerRef: Record<string, THREE.AnimationMixer | null>;
  animations: Record<string, string>;
  durations: Record<string, Record<string, [number, number]>>;
  speeds: Record<string, Record<string, number>>;
  loops: Record<string, Record<string, LoopType>>;
  currentTime: Record<string, number>;
  frameStep: Record<string, number>;
  freeze: Record<string, boolean>;
}

interface ModelsActions {
  loadFromFile: (uuid: string, file: File) => Promise<void>;
  reloadModel: (uuid: string) => Promise<void>;
  removeModel: (uuid: string) => void;
  setClips: (
    uuid: string,
    clips: {
      action: THREE.AnimationAction;
      clip: THREE.AnimationClip;
    }[],
  ) => void;
  setMixerRef: (uuid: string, mixer: THREE.AnimationMixer | null) => void;
  setAnimation: (uuid: string, animation: string) => void;
  setDuration: (
    uuid: string,
    animation: string,
    duration: [number, number],
  ) => void;
  setSpeed: (uuid: string, animation: string, speed: number) => void;
  setLoop: (uuid: string, animation: string, loop: LoopType) => void;
  setLoadState: (
    uuid: string,
    loadState: ModelLoadState,
    errorMessage?: string | null,
  ) => void;
  setCurrentTime: (uuid: string, time: number) => void;
  setFrameStep: (uuid: string, step: number) => void;
  setFreeze: (uuid: string, freeze: boolean) => void;
  hydrate: (models: Record<string, SerializableModel>) => void;
}

export const useModelsStore = create<ModelsState & ModelsActions>()(
  inspector(
    (set, get) => ({
      models: {},
      clips: {},
      mixerRef: {},
      animations: {},
      durations: {},
      speeds: {},
      loops: {},
      currentTime: {},
      frameStep: {},
      freeze: {},

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

      setMixerRef: (uuid, mixer) =>
        set((state) => ({ mixerRef: { ...state.mixerRef, [uuid]: mixer } })),

      setAnimation: (uuid, animation) =>
        set((state) => ({
          animations: { ...state.animations, [uuid]: animation },
        })),
      setDuration: (uuid, animation, duration) =>
        set((state) => ({
          durations: {
            ...state.durations,
            [uuid]: { ...state.durations[uuid], [animation]: duration },
          },
        })),
      setSpeed: (uuid, animation, speed) =>
        set((state) => ({
          speeds: {
            ...state.speeds,
            [uuid]: { ...state.speeds[uuid], [animation]: speed },
          },
        })),

      setLoop: (uuid, animation, loop) =>
        set((state) => ({
          loops: {
            ...state.loops,
            [uuid]: { ...state.loops[uuid], [animation]: loop },
          },
        })),

      setCurrentTime: (uuid, time) =>
        set((state) => ({
          currentTime: { ...state.currentTime, [uuid]: time },
        })),
      setFrameStep: (uuid, step) =>
        set((state) => ({
          frameStep: { ...state.frameStep, [uuid]: step },
        })),
      setFreeze: (uuid, freeze) =>
        set((state) => ({
          freeze: { ...state.freeze, [uuid]: freeze },
        })),

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
