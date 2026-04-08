import { create } from "zustand";
import { inspector } from "../../../../devtools/inspector-middleware";
import type {
  ModelComponent,
  ModelLoadState,
  SnapshotEnabledStore,
} from "@/types/ecs";
import * as THREE from "three";
import { saveFileToOPFS } from "@/utils/fs";
import { toast } from "sonner";
import {
  withHistory,
  type FieldWatcher,
} from "@/store/common/middlewares/history";

const modelCache = new Map<string, THREE.Object3D>();
const mixerCache = new Map<string, THREE.AnimationMixer>();
const clipsCache = new Map<
  string,
  { action: THREE.AnimationAction; clip: THREE.AnimationClip }[]
>();

export const getModelFromCache = (uuid: string) => modelCache.get(uuid) ?? null;
export const getMixerFromCache = (uuid: string) => mixerCache.get(uuid) ?? null;
export const getClipsFromCache = (uuid: string) => clipsCache.get(uuid) ?? [];

export type SerializableModel = Omit<
  ModelComponent,
  "loadState" | "errorMessage"
>;

export type LoopType = THREE.AnimationActionLoopStyles;

export interface ModelsState {
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

interface ModelsActions extends SnapshotEnabledStore<ModelsState> {
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
}

export const useModelsStore = create<ModelsState & ModelsActions>()(
  inspector(
    withHistory(
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
                ...state.models[uuid],
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

        getSnapshot: () => {
          return {
            models: Object.fromEntries(
              Object.entries(get().models).map(([uuid, m]) => [
                uuid,
                {
                  fileName: m.fileName,
                  filePath: m.filePath,
                  type: m.type,
                  fileSize: m.fileSize,
                  format: m.format,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any,
              ]),
            ),

            clips: {},
            mixerRef: {},

            animations: get().animations,
            durations: get().durations,
            speeds: get().speeds,
            loops: get().loops,
            currentTime: get().currentTime,
            frameStep: get().frameStep,
            freeze: get().freeze,
          };
        },

        hydrate: (snapshot) =>
          set({
            models: snapshot.models,
            animations: snapshot.animations,
            durations: snapshot.durations,
            speeds: snapshot.speeds,
            loops: snapshot.loops,
            currentTime: snapshot.currentTime,
            frameStep: snapshot.frameStep,
            freeze: snapshot.freeze,
          }),
      }),
      {
        name: "Models",
        watchers: [
          createFlatWatcher("animations", "model/animation"),
          createFlatWatcher("currentTime", "model/time"),
          createFlatWatcher("frameStep", "model/frameStep"),
          createFlatWatcher("freeze", "model/freeze"),

          createNestedWatcher("durations", "model/duration"),
          createNestedWatcher("speeds", "model/speed"),
          createNestedWatcher("loops", "model/loop"),
        ],
      },
    ),

    { name: "Models" },
  ),
);

function createNestedWatcher<K extends "durations" | "speeds" | "loops">(
  key: K,
  type: "model/duration" | "model/speed" | "model/loop",
): FieldWatcher<ModelsState & ModelsActions> {
  return {
    select: (state) => state[key],

    // @ts-expect-error Types are kinda broken
    toAction: (prev, next, api) => {
      const prevMap = prev[key];
      const nextMap = next[key];

      for (const uuid of Object.keys(nextMap)) {
        const prevInner = prevMap[uuid] || {};
        const nextInner = nextMap[uuid] || {};

        for (const anim of Object.keys(nextInner)) {
          const p = prevInner[anim];
          const n = nextInner[anim];

          if (p !== n) {
            return {
              type,
              uuid,
              from: { anim, value: p },
              to: { anim, value: n },

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              apply: ({ value }: any) => {
                const { anim, value: v } = value;

                switch (key) {
                  case "durations":
                    api.getState().setDuration(uuid, anim, v);
                    break;

                  case "speeds":
                    api.getState().setSpeed(uuid, anim, v);
                    break;

                  case "loops":
                    api.getState().setLoop(uuid, anim, v);
                    break;
                }
              },
            };
          }
        }
      }

      return null;
    },

    mergeKey: (prev, next) => {
      for (const uuid of Object.keys(next[key])) {
        const prevInner = prev[key][uuid] || {};
        const nextInner = next[key][uuid] || {};

        for (const anim of Object.keys(nextInner)) {
          if (prevInner[anim] !== nextInner[anim]) {
            return `model:${uuid}:${key}:${anim}`;
          }
        }
      }
    },
  };
}

function createFlatWatcher<
  K extends "animations" | "currentTime" | "frameStep" | "freeze",
>(
  key: K,
  type: "model/animation" | "model/time" | "model/frameStep" | "model/freeze",
): FieldWatcher<ModelsState & ModelsActions> {
  return {
    select: (state) => state[key],

    // @ts-expect-error Types are kinda broken
    toAction: (prev, next, api) => {
      const prevMap = prev[key];
      const nextMap = next[key];

      for (const uuid of Object.keys(nextMap)) {
        const p = prevMap[uuid];
        const n = nextMap[uuid];

        if (p !== n) {
          return {
            type,
            uuid,
            from: p,
            to: n,

            apply: ({ value }: { value: number | boolean | string }) => {
              switch (key) {
                case "animations":
                  api.getState().setAnimation(uuid, value as string);
                  break;
                case "currentTime":
                  api.getState().setCurrentTime(uuid, value as number);
                  break;
                case "frameStep":
                  api.getState().setFrameStep(uuid, value as number);
                  break;
                case "freeze":
                  api.getState().setFreeze(uuid, value as boolean);
                  break;
              }
            },
          };
        }
      }

      return null;
    },

    mergeKey: (prev, next) => {
      for (const uuid of Object.keys(next[key])) {
        if (prev[key][uuid] !== next[key][uuid]) {
          return `model:${uuid}:${key}`;
        }
      }
    },
  };
}

export const useModel = (uuid: string) =>
  useModelsStore((state) => state.models[uuid] ?? null);

export const useModelObject = (uuid: string) => getModelFromCache(uuid);
export const useModelMixer = (uuid: string) => getMixerFromCache(uuid);
export const useModelClips = (uuid: string) => getClipsFromCache(uuid);
