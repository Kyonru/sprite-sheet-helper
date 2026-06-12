import { create } from "zustand";
import { inspector } from "@kyonru/zustand-inspector";
import type {
  ModelComponent,
  ModelLoadState,
  SnapshotEnabledStore,
} from "@/types/ecs";
import * as THREE from "three";
import { saveFileToFS } from "@/utils/file-system/fs.web";
import { disposeParsedModel, parseModel } from "@/utils/model";
import { getRuntimeModel } from "@/utils/model-downgrade-runtime";
import {
  withHistory,
  type FieldWatcher,
} from "@/store/common/middlewares/history";
import {
  clearAllOriginalClips,
  clearOriginalClip,
  getOriginalClip,
  makeInPlaceClip,
  normalizeInPlaceAxisMode,
  rememberOriginalClip,
  type InPlaceAxisModeInput,
} from "@/utils/animation-clips";

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
  hiddenAnimations: Record<string, string[]>;
  currentTime: Record<string, number>;
  frameStep: Record<string, number>;
  freeze: Record<string, boolean>;
}

interface SourceModelImportOptions {
  forceInPlace?: boolean;
  inPlaceAxisMode?: InPlaceAxisModeInput;
}

interface ModelLoadOptions {
  autoFitOnLoad?: boolean;
}

interface ModelsActions extends SnapshotEnabledStore<ModelsState> {
  loadFromFile: (
    uuid: string,
    file: File,
    options?: ModelLoadOptions,
  ) => Promise<void>;
  attachStoredFile: (
    uuid: string,
    file: File,
    filePath: string,
    metadata?: Partial<ModelComponent>,
  ) => void;
  createAuthoredModel: (
    uuid: string,
    authoredModelId: string,
    name: string,
  ) => void;
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
  setAnimationHidden: (
    uuid: string,
    animation: string,
    hidden: boolean,
  ) => void;
  restoreHiddenAnimations: (uuid: string) => void;
  setLoadState: (
    uuid: string,
    loadState: ModelLoadState,
    errorMessage?: string | null,
  ) => void;
  setCurrentTime: (uuid: string, time: number) => void;
  setFrameStep: (uuid: string, step: number) => void;
  setFreeze: (uuid: string, freeze: boolean) => void;
  addClip: (uuid: string, clip: THREE.AnimationClip) => void;
  importAnimationsFromSource: (
    targetUuid: string,
    source:
      | ({ sourceModelUuid: string } & SourceModelImportOptions)
      | ({ sourceFile: File } & SourceModelImportOptions),
  ) => Promise<{ importedNames: string[] }>;
  forceCurrentAnimationInPlace: (
    targetUuid: string,
    animationName?: string,
    inPlaceAxisMode?: InPlaceAxisModeInput,
  ) => { name: string };
}

const initialState: ModelsState = {
  models: {},
  clips: {},
  mixerRef: {},
  animations: {},
  durations: {},
  speeds: {},
  loops: {},
  hiddenAnimations: {},
  currentTime: {},
  frameStep: {},
  freeze: {},
};

interface ModelsStore extends ModelsState, ModelsActions {}

export const useModelsStore = create<ModelsStore>()(
  inspector(
    withHistory(
      (set, get) => ({
        ...initialState,

        setLoadState: (uuid, loadState, errorMessage = null) =>
          set((state) => {
            const model = state.models[uuid];
            if (!model) return state;

            return {
              models: {
                ...state.models,
                [uuid]: { ...model, loadState, errorMessage },
              },
            };
          }),

        loadFromFile: async (uuid, file, options = {}) => {
          const { setLoadState } = get();
          const format = file.name
            .split(".")
            .pop()
            ?.toLowerCase() as ModelComponent["format"];

          try {
            const opfsFileName = await saveFileToFS(uuid, file, "models");

            set((state) => ({
              models: {
                ...state.models,
                [uuid]: {
                  ...state.models[uuid],
                  file,
                  fileName: file.name,
                  filePath: opfsFileName,
                  type: file.type,
                  fileSize: file.size,
                  format,
                  source: "file",
                  autoFitOnLoad: options.autoFitOnLoad ?? true,
                  loadState: "loading",
                  errorMessage: null,
                },
              },
            }));
          } catch (error) {
            const message = (error as Error).message;
            setLoadState(uuid, "error", message);
            throw error;
          }

          // loadState is intentionally set to "loading" above. Parse and runtime
          // setup are completed by the scene model component.
        },

        attachStoredFile: (uuid, file, filePath, metadata = {}) => {
          const format = (
            metadata.format ??
            file.name.split(".").pop()?.toLowerCase()
          ) as ModelComponent["format"];

          set((state) => ({
            models: {
              ...state.models,
              [uuid]: {
                ...state.models[uuid],
                ...metadata,
                file,
                fileName: metadata.fileName ?? file.name,
                filePath,
                type: metadata.type ?? file.type,
                fileSize: metadata.fileSize ?? file.size,
                format,
                source: "file",
                autoFitOnLoad: metadata.autoFitOnLoad ?? true,
                loadState: "loading",
                errorMessage: null,
              },
            },
          }));
        },

        createAuthoredModel: (uuid, authoredModelId, name) =>
          set((state) => ({
            models: {
              ...state.models,
              [uuid]: {
                source: "authored",
                authoredModelId,
                fileName: `${name}.authored`,
                filePath: "",
                fileSize: 0,
                type: "application/x-sprite-sheet-helper-authored",
                format: "authored",
                loadState: "loaded",
                errorMessage: null,
              },
            },
          })),

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
          const model = get().models[uuid];
          if (!model) return;

          mixerCache.get(uuid)?.stopAllAction();
          modelCache.delete(uuid);
          mixerCache.delete(uuid);
          clipsCache.delete(uuid);
          clearOriginalClip(uuid);

          set((state) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: _, ...models } = state.models;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: __, ...clips } = state.clips;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: ___, ...mixerRef } = state.mixerRef;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: ____, ...animations } = state.animations;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: _____, ...durations } = state.durations;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: ______, ...speeds } = state.speeds;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: _______, ...loops } = state.loops;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: ________, ...hiddenAnimations } =
              state.hiddenAnimations;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: _________, ...currentTime } = state.currentTime;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: __________, ...frameStep } = state.frameStep;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: ___________, ...freeze } = state.freeze;

            return {
              models,
              clips,
              mixerRef,
              animations,
              durations,
              speeds,
              loops,
              hiddenAnimations,
              currentTime,
              frameStep,
              freeze,
            };
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

        setAnimationHidden: (uuid, animation, hidden) =>
          set((state) => {
            if (!animation || animation === "none") return state;

            const current = state.hiddenAnimations[uuid] ?? [];
            const nextHidden = hidden
              ? Array.from(new Set([...current, animation]))
              : current.filter((name) => name !== animation);

            return {
              hiddenAnimations: {
                ...state.hiddenAnimations,
                [uuid]: nextHidden,
              },
              animations:
                hidden && state.animations[uuid] === animation
                  ? { ...state.animations, [uuid]: "none" }
                  : state.animations,
            };
          }),

        restoreHiddenAnimations: (uuid) =>
          set((state) => ({
            hiddenAnimations: {
              ...state.hiddenAnimations,
              [uuid]: [],
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

        addClip: (uuid, clip) => {
          const mixer = get().mixerRef[uuid];
          if (!mixer) return;
          const action = mixer.clipAction(clip);
          const existing = get().clips[uuid] ?? [];
          const updated = [...existing, { action, clip }];
          clipsCache.set(uuid, updated);
          console.log("addClip", uuid, clip);
          get().setClips(uuid, updated);
        },

        importAnimationsFromSource: async (targetUuid, source) => {
          const forceInPlace = source.forceInPlace ?? false;
          const inPlaceAxisMode = normalizeInPlaceAxisMode(
            source.inPlaceAxisMode,
          );
          const targetModel = get().models[targetUuid];
          if (!targetModel) {
            throw new Error("Target model not found");
          }

          if (targetModel.loadState !== "loaded") {
            throw new Error("Target model is not fully loaded");
          }

          const sourceFromModel =
            "sourceModelUuid" in source
              ? get().models[source.sourceModelUuid]
              : undefined;

          if ("sourceModelUuid" in source) {
            if (!sourceFromModel) {
              throw new Error("Source model not found");
            }

            if (source.sourceModelUuid === targetUuid) {
              throw new Error("Source and target models must be different");
            }

            if (sourceFromModel.loadState !== "loaded") {
              throw new Error("Source model is not fully loaded");
            }
          }

          let parsedSourceClips: THREE.AnimationClip[] = [];
          let sourceDurations: Record<string, [number, number]> = {};
          let sourceSpeeds: Record<string, number> = {};
          let sourceLoops: Record<string, LoopType> = {};

          if ("sourceFile" in source) {
            const file = source.sourceFile;
            const format = file.name
              .split(".")
              .pop()
              ?.toLowerCase() as ModelComponent["format"];

            if (!format) {
              throw new Error("Source file has no extension");
            }

            const parsed = await parseModel(file, format);
            try {
              parsedSourceClips = parsed.clips.map((clipRef) =>
                forceInPlace
                  ? makeInPlaceClip(clipRef.clip, inPlaceAxisMode)
                  : clipRef.clip.clone(),
              );
            } finally {
              disposeParsedModel(parsed);
            }
          } else {
            const sourceClips = get().clips[source.sourceModelUuid] ?? [];

            if (sourceClips.length === 0) {
              throw new Error("Source model has no importable animations");
            }

            parsedSourceClips = sourceClips.map((clipRef) =>
              forceInPlace
                ? makeInPlaceClip(clipRef.clip, inPlaceAxisMode)
                : clipRef.clip.clone(),
            );
            sourceDurations = get().durations[source.sourceModelUuid] ?? {};
            sourceSpeeds = get().speeds[source.sourceModelUuid] ?? {};
            sourceLoops = get().loops[source.sourceModelUuid] ?? {};
          }

          if (parsedSourceClips.length === 0) {
            return { importedNames: [] };
          }

          let targetMixer = get().mixerRef[targetUuid];
          if (!targetMixer) {
            const runtime = getRuntimeModel(targetUuid);
            if (runtime?.object) {
              targetMixer = new THREE.AnimationMixer(runtime.object);
            }
          }

          if (!targetMixer) {
            throw new Error("Target model has no runtime mixer");
          }

          const current = get();
          const existing = current.clips[targetUuid] ?? [];
          const existingNames = new Set(
            existing.map((entry) => entry.clip.name.trim()),
          );

          const durationMap = {
            ...(current.durations[targetUuid] ?? {}),
          } as Record<string, [number, number]>;

          const speedMap = {
            ...(current.speeds[targetUuid] ?? {}),
          } as Record<string, number>;

          const loopMap = {
            ...(current.loops[targetUuid] ?? {}),
          } as Record<string, LoopType>;

          const preparedClips = parsedSourceClips.map((clip) => {
            const originalName = clip.name || "Imported Clip";
            const resolvedName = forceInPlace
              ? originalName.trim()
              : resolveCollisionName(originalName, existingNames);
            clip.name = resolvedName;
            if (!forceInPlace) {
              existingNames.add(resolvedName);
            }

            const sourceDuration = sourceDurations[originalName];
            if (sourceDuration) {
              durationMap[resolvedName] = sourceDuration;
            }

            const sourceSpeed = sourceSpeeds[originalName];
            if (sourceSpeed !== undefined) {
              speedMap[resolvedName] = sourceSpeed;
            }

            const sourceLoop = sourceLoops[originalName];
            if (sourceLoop !== undefined) {
              loopMap[resolvedName] = sourceLoop;
            }

            return {
              action: targetMixer.clipAction(clip),
              clip,
              name: resolvedName,
              originalName,
            };
          });

          const importedNames = preparedClips.map((entry) => entry.clip.name);

          set((state) => {
            const nextClips = [...(state.clips[targetUuid] ?? [])];
            if (forceInPlace) {
              for (const { action, clip, name } of preparedClips) {
                const index = nextClips.findIndex(
                  (entry) => entry.clip.name.trim() === name,
                );

                if (index >= 0) {
                  const existing = nextClips[index];
                  if (existing) {
                    existing.action?.stop();
                    targetMixer?.uncacheAction(existing.clip);
                    targetMixer?.uncacheClip(existing.clip);
                  }

                  nextClips[index] = {
                    action,
                    clip,
                  };
                  continue;
                }

                nextClips.push({ action, clip });
              }
            } else {
              nextClips.push(...preparedClips);
            }

            clipsCache.set(targetUuid, nextClips);

            return {
              mixerRef: {
                ...state.mixerRef,
                [targetUuid]: targetMixer,
              },
              clips: {
                ...state.clips,
                [targetUuid]: nextClips,
              },
              durations: {
                ...state.durations,
                [targetUuid]: durationMap,
              },
              speeds: {
                ...state.speeds,
                [targetUuid]: speedMap,
              },
              loops: {
                ...state.loops,
                [targetUuid]: loopMap,
              },
            };
          });

          return { importedNames };
        },

        forceCurrentAnimationInPlace: (
          targetUuid,
          animationName,
          inPlaceAxisMode = "all",
        ) => {
          const axisMode = normalizeInPlaceAxisMode(inPlaceAxisMode);
          const targetModel = get().models[targetUuid];
          if (!targetModel) {
            throw new Error("Target model not found");
          }

          if (targetModel.loadState !== "loaded") {
            throw new Error("Target model is not fully loaded");
          }

          const selectedAnimation = get().animations[targetUuid];
          const clipName = animationName ?? selectedAnimation;

          if (!clipName || clipName === "none") {
            throw new Error("No animation selected");
          }

          const currentClips = get().clips[targetUuid] ?? [];
          const targetIndex = currentClips.findIndex(
            (entry) => entry.clip.name === clipName,
          );

          if (targetIndex < 0) {
            throw new Error("Selected animation not found");
          }

          let targetMixer = get().mixerRef[targetUuid];
          if (!targetMixer) {
            const runtime = getRuntimeModel(targetUuid);
            if (runtime?.object) {
              targetMixer = new THREE.AnimationMixer(runtime.object);
            }
          }

          if (!targetMixer) {
            throw new Error("Target model has no runtime mixer");
          }

          const sourceClipRef = currentClips[targetIndex];
          if (!sourceClipRef) {
            throw new Error("Selected animation not found");
          }

          if (axisMode !== "none") {
            rememberOriginalClip(targetUuid, sourceClipRef.clip);
          }

          const nextClip =
            axisMode === "none"
              ? (getOriginalClip(targetUuid, clipName) ?? sourceClipRef.clip.clone())
              : makeInPlaceClip(sourceClipRef.clip, axisMode);
          const action = targetMixer.clipAction(nextClip);

          const nextClips = [...currentClips];
          const existing = nextClips[targetIndex];
          if (existing) {
            existing.action?.stop();
            targetMixer.uncacheAction(existing.clip);
            targetMixer.uncacheClip(existing.clip);
          }

          nextClips[targetIndex] = {
            action,
            clip: nextClip,
          };
          clipsCache.set(targetUuid, nextClips);

          set((state) => ({
            mixerRef: {
              ...state.mixerRef,
              [targetUuid]: targetMixer,
            },
            clips: {
              ...state.clips,
              [targetUuid]: nextClips,
            },
          }));

          return { name: nextClip.name };
        },

        reset: () => {
          modelCache.clear();
          mixerCache.clear();
          clipsCache.clear();
          clearAllOriginalClips();
          set(initialState);
        },

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
                  source: m.source ?? "file",
                  authoredModelId: m.authoredModelId,
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
            hiddenAnimations: get().hiddenAnimations,
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
            hiddenAnimations: snapshot.hiddenAnimations ?? {},
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
          createHiddenAnimationsWatcher(),
        ],
      },
    ),

    { name: "Models", enabled: import.meta.env.DEV },
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

function createHiddenAnimationsWatcher(): FieldWatcher<
  ModelsState & ModelsActions
> {
  const normalizeList = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];
  const listKey = (value: unknown) => normalizeList(value).join("\0");

  return {
    select: (state) => state.hiddenAnimations,

    toAction: (prev, next, api) => {
      const prevMap = prev.hiddenAnimations;
      const nextMap = next.hiddenAnimations;

      for (const uuid of new Set([
        ...Object.keys(prevMap),
        ...Object.keys(nextMap),
      ])) {
        const p = normalizeList(prevMap[uuid]);
        const n = normalizeList(nextMap[uuid]);

        if (listKey(p) !== listKey(n)) {
          return {
            type: "model/hiddenAnimations",
            uuid,
            from: [...p],
            to: [...n],

            apply: ({ value }: { value: string[] }) => {
              const hiddenAnimations = normalizeList(value);
              api.setState((state) => ({
                hiddenAnimations: {
                  ...state.hiddenAnimations,
                  [uuid]: [...hiddenAnimations],
                },
              }));
            },
          };
        }
      }

      return null;
    },

    mergeKey: (prev, next) => {
      const prevMap = prev.hiddenAnimations;
      const nextMap = next.hiddenAnimations;

      for (const uuid of new Set([
        ...Object.keys(prevMap),
        ...Object.keys(nextMap),
      ])) {
        if (listKey(prevMap[uuid]) !== listKey(nextMap[uuid])) {
          return `model:${uuid}:hiddenAnimations`;
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


export function resolveCollisionName(base: string, taken: Set<string>): string {
  const trimmed = base.trim();
  if (!taken.has(trimmed)) return trimmed;

  let attempt = 1;
  while (taken.has(`${trimmed}_${attempt}`)) attempt += 1;
  return `${trimmed}_${attempt}`;
}

export const useModel = (uuid: string) =>
  useModelsStore((state) => state.models[uuid] ?? null);

export const useModelObject = (uuid: string) => getModelFromCache(uuid);
export const useModelMixer = (uuid: string) => getMixerFromCache(uuid);
export const useModelClips = (uuid: string) => getClipsFromCache(uuid);
