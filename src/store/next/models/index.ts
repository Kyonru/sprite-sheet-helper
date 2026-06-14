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
import {
  clearDowngradedRuntimeModel,
  getRuntimeModel,
  setOriginalRuntimeClips,
} from "@/utils/model-downgrade-runtime";
import {
  withHistory,
  type FieldWatcher,
} from "@/store/common/middlewares/history";
import { useHistoryStore } from "@/store/next/history";
import {
  clearAllOriginalClips,
  clearOriginalClip,
  getOriginalClip,
  makeInPlaceClip,
  normalizeInPlaceAxisMode,
  rememberOriginalClip,
  renameOriginalClip,
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
export type SerializableAnimationClip = ReturnType<
  typeof THREE.AnimationClip.toJSON
>;

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
  animationRenames: Record<string, Record<string, string>>;
  importedClips: Record<string, Record<string, SerializableAnimationClip>>;
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
    options?: { applyPersistedImports?: boolean },
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
  renameAnimation: (
    uuid: string,
    fromName: string,
    toName: string,
  ) => { name: string };
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
  animationRenames: {},
  importedClips: {},
  currentTime: {},
  frameStep: {},
  freeze: {},
};

interface ModelsStore extends ModelsState, ModelsActions {}

type ClipEntry = ModelsState["clips"][string][number];

function normalizeAnimationRenameName(name: string) {
  return name.trim();
}

function validateAnimationRename(
  state: ModelsStore,
  uuid: string,
  fromName: string,
  toName: string,
) {
  if (!fromName || fromName === "none") {
    return "Select an animation to rename";
  }

  if (!toName) {
    return "Animation name is required";
  }

  if (toName === "none") {
    return '"none" is reserved for the empty animation selection';
  }

  const currentClips = state.clips[uuid] ?? [];
  const sourceIndex = currentClips.findIndex(
    (entry) => entry.clip.name === fromName,
  );

  if (sourceIndex < 0) {
    return "Animation not found";
  }

  if (fromName === toName) {
    return null;
  }

  const hasDuplicateName = currentClips.some(
    (entry, index) => index !== sourceIndex && entry.clip.name === toName,
  );

  return hasDuplicateName ? "Animation name already exists" : null;
}

function renameNestedAnimationKey<T>(
  records: Record<string, Record<string, T>>,
  uuid: string,
  fromName: string,
  toName: string,
) {
  const current = records[uuid];
  if (!current || !(fromName in current)) return records;

  const { [fromName]: value, ...rest } = current;
  return {
    ...records,
    [uuid]: {
      ...rest,
      [toName]: value,
    },
  };
}

function renameSelectedAnimation(
  animations: Record<string, string>,
  uuid: string,
  fromName: string,
  toName: string,
) {
  if (animations[uuid] !== fromName) return animations;
  return { ...animations, [uuid]: toName };
}

function renameHiddenAnimation(
  hiddenAnimations: Record<string, string[]>,
  uuid: string,
  fromName: string,
  toName: string,
) {
  const current = hiddenAnimations[uuid];
  if (!current?.includes(fromName)) return hiddenAnimations;

  return {
    ...hiddenAnimations,
    [uuid]: Array.from(
      new Set(current.map((name) => (name === fromName ? toName : name))),
    ),
  };
}

function updateAnimationRenameMap(
  animationRenames: Record<string, Record<string, string>>,
  uuid: string,
  fromName: string,
  toName: string,
) {
  const current = animationRenames[uuid] ?? {};
  const originalName =
    Object.entries(current).find(
      ([, renamedName]) => renamedName === fromName,
    )?.[0] ?? fromName;
  const next = { ...current };

  if (originalName === toName) {
    delete next[originalName];
  } else {
    next[originalName] = toName;
  }

  if (Object.keys(next).length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [uuid]: _, ...rest } = animationRenames;
    return rest;
  }

  return {
    ...animationRenames,
    [uuid]: next,
  };
}

function applyAnimationRenamesToClips(
  uuid: string,
  clips: ClipEntry[],
  animationRenames: Record<string, Record<string, string>>,
) {
  const renames = animationRenames[uuid];
  if (!renames || Object.keys(renames).length === 0) return clips;

  let changed = false;
  const renamedClips = clips.map((entry) => {
    const renamedName = renames[entry.clip.name];
    if (!renamedName || renamedName === entry.clip.name) return entry;

    changed = true;
    entry.clip.name = renamedName;
    return { ...entry, clip: entry.clip };
  });

  return changed ? renamedClips : clips;
}

function serializeAnimationClip(
  clip: THREE.AnimationClip,
): SerializableAnimationClip {
  return THREE.AnimationClip.toJSON(clip) as SerializableAnimationClip;
}

function deserializeAnimationClip(
  clipSnapshot: SerializableAnimationClip,
): THREE.AnimationClip | null {
  try {
    return THREE.AnimationClip.parse(clipSnapshot);
  } catch {
    return null;
  }
}

function getClipEntryMixer(
  uuid: string,
  state: ModelsStore,
  clips: ClipEntry[],
) {
  const currentMixer = state.mixerRef[uuid] ?? mixerCache.get(uuid);
  if (currentMixer) return currentMixer;

  const actionMixer = (
    clips[0]?.action as { getMixer?: () => THREE.AnimationMixer }
  )?.getMixer?.();
  if (actionMixer) return actionMixer;

  const runtime = getRuntimeModel(uuid);
  return runtime?.object ? new THREE.AnimationMixer(runtime.object) : null;
}

function mergePersistedImportedClips(
  uuid: string,
  clips: ClipEntry[],
  state: ModelsStore,
) {
  const importedClips = state.importedClips[uuid] ?? {};
  if (Object.keys(importedClips).length === 0) {
    return {
      clips: applyAnimationRenamesToClips(uuid, clips, state.animationRenames),
      mixer: state.mixerRef[uuid] ?? mixerCache.get(uuid) ?? null,
    };
  }

  const mixer = getClipEntryMixer(uuid, state, clips);
  const nextClips = [
    ...applyAnimationRenamesToClips(uuid, clips, state.animationRenames),
  ];
  const renames = state.animationRenames[uuid] ?? {};

  for (const clipSnapshot of Object.values(importedClips)) {
    const importedClip = deserializeAnimationClip(clipSnapshot);
    if (!importedClip) continue;

    importedClip.name = renames[importedClip.name] ?? importedClip.name;
    const action = mixer
      ? mixer.clipAction(importedClip)
      : ({} as THREE.AnimationAction);
    const index = nextClips.findIndex(
      (entry) => entry.clip.name === importedClip.name,
    );

    if (index >= 0) {
      nextClips[index] = { action, clip: importedClip };
      continue;
    }

    nextClips.push({ action, clip: importedClip });
  }

  return { clips: nextClips, mixer };
}

function upsertImportedClipSnapshots(
  importedClips: ModelsState["importedClips"],
  uuid: string,
  clips: THREE.AnimationClip[],
) {
  if (clips.length === 0) return importedClips;

  return {
    ...importedClips,
    [uuid]: {
      ...(importedClips[uuid] ?? {}),
      ...Object.fromEntries(
        clips.map((clip) => [clip.name, serializeAnimationClip(clip)]),
      ),
    },
  };
}

function renameImportedClipSnapshot(
  importedClips: ModelsState["importedClips"],
  uuid: string,
  fromName: string,
  toName: string,
) {
  const current = importedClips[uuid];
  const snapshot = current?.[fromName];
  if (!current || !snapshot) return importedClips;

  const clip = deserializeAnimationClip(snapshot);
  if (!clip) return importedClips;

  clip.name = toName;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [fromName]: _removed, ...rest } = current;
  return {
    ...importedClips,
    [uuid]: {
      ...rest,
      [toName]: serializeAnimationClip(clip),
    },
  };
}

function renameClipEntry(
  entry: ClipEntry,
  mixer: THREE.AnimationMixer | null | undefined,
  toName: string,
): ClipEntry {
  const nextClip = entry.clip.clone();
  nextClip.name = toName;

  if (!mixer) {
    return {
      action: entry.action,
      clip: nextClip,
    };
  }

  entry.action?.stop();
  mixer.uncacheAction(entry.clip);
  mixer.uncacheClip(entry.clip);

  return {
    action: mixer.clipAction(nextClip),
    clip: nextClip,
  };
}

function renameAnimationInState(
  state: ModelsStore,
  uuid: string,
  fromName: string,
  toName: string,
): Partial<ModelsState> {
  const currentClips = state.clips[uuid] ?? [];
  const clipIndex = currentClips.findIndex(
    (entry) => entry.clip.name === fromName,
  );

  if (clipIndex < 0) return {};

  const mixer = state.mixerRef[uuid] ?? mixerCache.get(uuid) ?? null;
  const nextClips = currentClips.map((entry, index) =>
    index === clipIndex ? renameClipEntry(entry, mixer, toName) : entry,
  );

  clipsCache.set(uuid, nextClips);
  renameOriginalClip(uuid, fromName, toName);

  return {
    clips: {
      ...state.clips,
      [uuid]: nextClips,
    },
    mixerRef:
      mixer && state.mixerRef[uuid] !== mixer
        ? {
            ...state.mixerRef,
            [uuid]: mixer,
          }
        : state.mixerRef,
    animations: renameSelectedAnimation(
      state.animations,
      uuid,
      fromName,
      toName,
    ),
    durations: renameNestedAnimationKey(
      state.durations,
      uuid,
      fromName,
      toName,
    ),
    speeds: renameNestedAnimationKey(
      state.speeds,
      uuid,
      fromName,
      toName,
    ),
    loops: renameNestedAnimationKey(state.loops, uuid, fromName, toName),
    hiddenAnimations: renameHiddenAnimation(
      state.hiddenAnimations,
      uuid,
      fromName,
      toName,
    ),
    animationRenames: updateAnimationRenameMap(
      state.animationRenames,
      uuid,
      fromName,
      toName,
    ),
    importedClips: renameImportedClipSnapshot(
      state.importedClips,
      uuid,
      fromName,
      toName,
    ),
  };
}

export const useModelsStore = create<ModelsStore>()(
  inspector(
    withHistory(
      (set, get, api) => ({
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
            const { [uuid]: _________, ...animationRenames } =
              state.animationRenames;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: __________, ...importedClips } =
              state.importedClips;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: ___________, ...currentTime } = state.currentTime;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: ____________, ...frameStep } = state.frameStep;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: _____________, ...freeze } = state.freeze;

            return {
              models,
              clips,
              mixerRef,
              animations,
              durations,
              speeds,
              loops,
              hiddenAnimations,
              animationRenames,
              importedClips,
              currentTime,
              frameStep,
              freeze,
            };
          });
        },

        setClips: (uuid, clips, options = {}) =>
          set((state) => {
            const shouldApplyImports = options.applyPersistedImports ?? true;
            const result = shouldApplyImports
              ? mergePersistedImportedClips(uuid, clips, state)
              : {
                  clips: applyAnimationRenamesToClips(
                    uuid,
                    clips,
                    state.animationRenames,
                  ),
                  mixer: state.mixerRef[uuid] ?? mixerCache.get(uuid) ?? null,
                };

            if (result.mixer) {
              mixerCache.set(uuid, result.mixer);
            }
            clipsCache.set(uuid, result.clips);

            return {
              clips: { ...state.clips, [uuid]: result.clips },
              ...(result.mixer && state.mixerRef[uuid] !== result.mixer
                ? {
                    mixerRef: {
                      ...state.mixerRef,
                      [uuid]: result.mixer,
                    },
                  }
                : {}),
            };
          }),

        setMixerRef: (uuid, mixer) => {
          if (mixer) {
            mixerCache.set(uuid, mixer);
          } else {
            mixerCache.delete(uuid);
          }
          set((state) => ({ mixerRef: { ...state.mixerRef, [uuid]: mixer } }));
        },

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

        renameAnimation: (uuid, fromName, toName) => {
          const sourceName = normalizeAnimationRenameName(fromName);
          const targetName = normalizeAnimationRenameName(toName);
          const validationError = validateAnimationRename(
            get(),
            uuid,
            sourceName,
            targetName,
          );

          if (validationError) {
            throw new Error(validationError);
          }

          if (sourceName === targetName) {
            return { name: sourceName };
          }

          api.setState((state) =>
            renameAnimationInState(state, uuid, sourceName, targetName),
          );

          useHistoryStore.getState().push({
            type: "model/animationRename",
            uuid,
            from: sourceName,
            to: targetName,
            apply: ({ dir, value }) => {
              const currentName = dir === "forward" ? sourceName : targetName;
              api.setState((state) =>
                renameAnimationInState(state, uuid, currentName, value),
              );
            },
          });

          return { name: targetName };
        },

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
          setOriginalRuntimeClips(uuid, updated, mixer);
          clearDowngradedRuntimeModel(uuid);
          set((state) => ({
            clips: {
              ...state.clips,
              [uuid]: updated,
            },
            importedClips: upsertImportedClipSnapshots(
              state.importedClips,
              uuid,
              [clip],
            ),
          }));
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
            setOriginalRuntimeClips(targetUuid, nextClips, targetMixer);
            clearDowngradedRuntimeModel(targetUuid);

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
              importedClips: upsertImportedClipSnapshots(
                state.importedClips,
                targetUuid,
                preparedClips.map((entry) => entry.clip),
              ),
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
          setOriginalRuntimeClips(targetUuid, nextClips, targetMixer);
          clearDowngradedRuntimeModel(targetUuid);

          set((state) => ({
            mixerRef: {
              ...state.mixerRef,
              [targetUuid]: targetMixer,
            },
            clips: {
              ...state.clips,
              [targetUuid]: nextClips,
            },
            ...(state.importedClips[targetUuid]?.[clipName]
              ? {
                  importedClips: upsertImportedClipSnapshots(
                    state.importedClips,
                    targetUuid,
                    [nextClip],
                  ),
                }
              : {}),
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
            animationRenames: get().animationRenames,
            importedClips: get().importedClips,
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
            animationRenames: snapshot.animationRenames ?? {},
            importedClips: snapshot.importedClips ?? {},
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

            apply: ({ value }) => {
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
