import * as THREE from "three";
import { useCamerasStore } from "@/store/next/cameras";
import { useEntitiesStore } from "@/store/next/entities";
import { useLightsStore } from "@/store/next/lights";
import { useModelsStore } from "@/store/next/models";
import { useSettingsStore } from "@/store/next/settings";
import { useTransformsStore } from "@/store/next/transforms";
import type { InPlaceAxisModeInput } from "@/utils/animation-clips";
import { getRuntimeModel } from "@/utils/model-downgrade-runtime";

const RELOAD_STATUS_KEY = "sprite-sheet-helper.reload-status-before-v1";

type Vec3 = [number, number, number];

type ReloadStatusDebugOptions = {
  reload?: boolean;
  waitMs?: number;
};

type RuntimeModelStatus = {
  objectName: string;
  objectType: string;
  objectUuid: string;
  scale: Vec3;
  worldScale: Vec3;
  position: Vec3;
  bounds: {
    min: Vec3;
    max: Vec3;
    size: Vec3;
    center: Vec3;
  };
  childCount: number;
};

type ModelStatus = {
  uuid: string;
  name?: string;
  transform?: {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
  };
  model?: {
    source?: string;
    fileName?: string;
    filePath?: string;
    fileSize?: number;
    format?: string;
    loadState?: string;
    errorMessage?: string | null;
    autoFitOnLoad?: boolean;
  };
  runtime: RuntimeModelStatus | null;
};

type ReloadStatusDebugSnapshot = {
  capturedAt: string;
  url: string;
  projectName: string;
  counts: {
    entities: number;
    models: number;
    cameras: number;
    lights: number;
  };
  activeCamera?: {
    uuid: string;
    camera: unknown;
    transform?: unknown;
  };
  models: ModelStatus[];
};

type AnimationTrackStatus = {
  name: string;
  valueSize: number;
  times: number[];
  values: number[];
  positionKeys?: Array<{
    time: number;
    x: number;
    y: number;
    z: number;
  }>;
};

type AnimationStatusSnapshot = {
  capturedAt: string;
  modelUuid: string;
  modelName?: string;
  activeAnimation?: string;
  requestedAnimation?: string;
  selectedEntity?: string;
  clips: Array<{
    name: string;
    duration: number;
    positionTracks: AnimationTrackStatus[];
  }>;
};

declare global {
  interface Window {
    sshReloadStatus?: (
      options?: ReloadStatusDebugOptions,
    ) => Promise<ReloadStatusDebugSnapshot | unknown>;
    sshCopyStatus?: () => Promise<ReloadStatusDebugSnapshot>;
    sshAnimationStatus?: (
      options?: { modelUuid?: string; animationName?: string },
    ) => Promise<AnimationStatusSnapshot>;
    sshAnimationBefore?: (
      options?: { modelUuid?: string; animationName?: string },
    ) => AnimationStatusSnapshot;
    sshAnimationAfter?: (
      options?: { modelUuid?: string; animationName?: string },
    ) => Promise<unknown>;
    sshForceAnimationInPlaceDebug?: (
      mode?: InPlaceAxisModeInput,
      options?: { modelUuid?: string; animationName?: string },
    ) => Promise<unknown>;
  }
}

function vectorToTuple(vector: THREE.Vector3): Vec3 {
  return [vector.x, vector.y, vector.z];
}

function readRuntimeModel(uuid: string): RuntimeModelStatus | null {
  const runtime = getRuntimeModel(uuid);
  const object = runtime?.object;
  if (!object) return null;

  object.updateMatrixWorld(true);

  const worldScale = new THREE.Vector3();
  const bounds = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  object.getWorldScale(worldScale);

  return {
    objectName: object.name,
    objectType: object.type,
    objectUuid: object.uuid,
    scale: vectorToTuple(object.scale),
    worldScale: vectorToTuple(worldScale),
    position: vectorToTuple(object.position),
    bounds: {
      min: vectorToTuple(bounds.min),
      max: vectorToTuple(bounds.max),
      size: vectorToTuple(size),
      center: vectorToTuple(center),
    },
    childCount: object.children.length,
  };
}

function collectReloadStatus(): ReloadStatusDebugSnapshot {
  const entities = useEntitiesStore.getState().entities;
  const transforms = useTransformsStore.getState().transforms;
  const models = useModelsStore.getState().models;
  const cameras = useCamerasStore.getState();
  const lights = useLightsStore.getState().lights;
  const settings = useSettingsStore.getState();

  return {
    capturedAt: new Date().toISOString(),
    url: window.location.href,
    projectName: settings.name,
    counts: {
      entities: Object.keys(entities).length,
      models: Object.keys(models).length,
      cameras: Object.keys(cameras.cameras).length,
      lights: Object.keys(lights).length,
    },
    activeCamera: cameras.mainCamera
      ? {
          uuid: cameras.mainCamera,
          camera: cameras.cameras[cameras.mainCamera],
          transform: transforms[cameras.mainCamera],
        }
      : undefined,
    models: Object.entries(models).map(([uuid, model]) => ({
      uuid,
      name: entities[uuid]?.name,
      transform: transforms[uuid],
      model: {
        source: model.source,
        fileName: model.fileName,
        filePath: model.filePath,
        fileSize: model.fileSize,
        format: model.format,
        loadState: model.loadState,
        errorMessage: model.errorMessage,
        autoFitOnLoad: model.autoFitOnLoad,
      },
      runtime: readRuntimeModel(uuid),
    })),
  };
}

function readAnimationTrackStatus(
  track: THREE.KeyframeTrack,
): AnimationTrackStatus {
  const valueSize = track.getValueSize();
  const times = Array.from(track.times);
  const values = Array.from(track.values);
  const positionKeys =
    valueSize === 3
      ? times.map((time, index) => {
          const offset = index * 3;
          return {
            time,
            x: values[offset] ?? 0,
            y: values[offset + 1] ?? 0,
            z: values[offset + 2] ?? 0,
          };
        })
      : undefined;

  return {
    name: track.name,
    valueSize,
    times,
    values,
    positionKeys,
  };
}

function collectAnimationStatus(options: {
  modelUuid?: string;
  animationName?: string;
} = {}): AnimationStatusSnapshot {
  const entities = useEntitiesStore.getState().entities;
  const selectedEntity = useEntitiesStore.getState().selected;
  const models = useModelsStore.getState();
  const modelUuid =
    options.modelUuid ??
    selectedEntity ??
    Object.keys(models.clips).find((uuid) => models.clips[uuid]?.length);

  if (!modelUuid) {
    throw new Error("No model selected and no model clips found.");
  }

  const activeAnimation = models.animations[modelUuid];
  const requestedAnimation = options.animationName ?? activeAnimation;
  const clips = (models.clips[modelUuid] ?? [])
    .filter((clipRef) =>
      requestedAnimation && requestedAnimation !== "none"
        ? clipRef.clip.name === requestedAnimation
        : true,
    )
    .map((clipRef) => ({
      name: clipRef.clip.name,
      duration: clipRef.clip.duration,
      positionTracks: clipRef.clip.tracks
        .filter((track) => track.name.endsWith(".position"))
        .map(readAnimationTrackStatus),
    }));

  return {
    capturedAt: new Date().toISOString(),
    modelUuid,
    modelName: entities[modelUuid]?.name,
    activeAnimation,
    requestedAnimation,
    selectedEntity,
    clips,
  };
}

function buildAnimationDiff(
  before: AnimationStatusSnapshot,
  after: AnimationStatusSnapshot,
) {
  const afterClips = new Map(after.clips.map((clip) => [clip.name, clip]));

  return before.clips.map((clip) => {
    const nextClip = afterClips.get(clip.name);
    const nextTracks = new Map(
      nextClip?.positionTracks.map((track) => [track.name, track]) ?? [],
    );

    return {
      clip: clip.name,
      tracks: clip.positionTracks.map((track) => {
        const nextTrack = nextTracks.get(track.name);
        return {
          track: track.name,
          before: track.positionKeys,
          after: nextTrack?.positionKeys,
          changedAxes: track.positionKeys?.map((key, index) => {
            const nextKey = nextTrack?.positionKeys?.[index];
            return {
              time: key.time,
              x: nextKey ? key.x !== nextKey.x : undefined,
              y: nextKey ? key.y !== nextKey.y : undefined,
              z: nextKey ? key.z !== nextKey.z : undefined,
            };
          }),
        };
      }),
    };
  });
}

function buildModelDiff(
  before: ReloadStatusDebugSnapshot,
  after: ReloadStatusDebugSnapshot,
) {
  const afterById = new Map(after.models.map((model) => [model.uuid, model]));

  return before.models.map((model) => {
    const next = afterById.get(model.uuid);
    return {
      uuid: model.uuid,
      name: model.name,
      before: {
        transformScale: model.transform?.scale,
        runtimeScale: model.runtime?.scale,
        runtimeWorldScale: model.runtime?.worldScale,
        runtimeBoundsSize: model.runtime?.bounds.size,
        loadState: model.model?.loadState,
        autoFitOnLoad: model.model?.autoFitOnLoad,
      },
      after: {
        transformScale: next?.transform?.scale,
        runtimeScale: next?.runtime?.scale,
        runtimeWorldScale: next?.runtime?.worldScale,
        runtimeBoundsSize: next?.runtime?.bounds.size,
        loadState: next?.model?.loadState,
        autoFitOnLoad: next?.model?.autoFitOnLoad,
      },
    };
  });
}

async function waitForModelRuntime(waitMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < waitMs) {
    const models = useModelsStore.getState().models;
    const pending = Object.entries(models).some(([uuid, model]) => {
      if (model.source === "authored") return false;
      return model.loadState === "loading" || !getRuntimeModel(uuid)?.object;
    });

    if (!pending) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn("[sshReloadStatus] Clipboard write failed.", error);
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (copied) return true;
  } catch (error) {
    console.warn("[sshReloadStatus] execCommand copy fallback failed.", error);
  }

  const popup = window.open("", "ssh-reload-status", "width=900,height=700");
  if (popup) {
    popup.document.title = "Sprite Sheet Helper Reload Status";
    popup.document.body.innerHTML = "";
    const textarea = popup.document.createElement("textarea");
    textarea.value = text;
    textarea.style.boxSizing = "border-box";
    textarea.style.width = "100vw";
    textarea.style.height = "100vh";
    textarea.style.margin = "0";
    textarea.style.padding = "12px";
    textarea.style.font = "12px monospace";
    popup.document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
  }

  return false;
}

export function installReloadStatusDebug() {
  if (typeof window === "undefined") return;
  if (window.sshReloadStatus) return;

  window.sshCopyStatus = async () => {
    await waitForModelRuntime(5000);
    const status = collectReloadStatus();
    const copied = await copyText(JSON.stringify(status, null, 2));
    console.info(
      copied
        ? "[sshReloadStatus] Current status copied to clipboard."
        : "[sshReloadStatus] Current status returned and opened in a copy window.",
      status,
    );
    return status;
  };

  window.sshReloadStatus = async (options = {}) => {
    const waitMs = options.waitMs ?? 5000;
    await waitForModelRuntime(waitMs);

    const beforeRaw = window.localStorage.getItem(RELOAD_STATUS_KEY);
    const current = collectReloadStatus();

    if (!beforeRaw) {
      window.localStorage.setItem(RELOAD_STATUS_KEY, JSON.stringify(current));
      console.info(
        "[sshReloadStatus] Captured before-reload status. Run window.sshReloadStatus() again after reload to copy the before/after report.",
        current,
      );

      if (options.reload !== false) {
        window.location.reload();
      }

      return current;
    }

    const before = JSON.parse(beforeRaw) as ReloadStatusDebugSnapshot;
    const report = {
      createdAt: new Date().toISOString(),
      before,
      after: current,
      diff: {
        counts: {
          before: before.counts,
          after: current.counts,
        },
        models: buildModelDiff(before, current),
      },
    };

    window.localStorage.removeItem(RELOAD_STATUS_KEY);
    const copied = await copyText(JSON.stringify(report, null, 2));
    console.info(
      copied
        ? "[sshReloadStatus] Before/after reload report copied."
        : "[sshReloadStatus] Before/after reload report returned and opened in a copy window.",
      report,
    );
    return report;
  };

  window.sshAnimationStatus = async (options = {}) => {
    const status = collectAnimationStatus(options);
    const copied = await copyText(JSON.stringify(status, null, 2));
    console.info(
      copied
        ? "[sshAnimationStatus] Animation status copied."
        : "[sshAnimationStatus] Animation status returned and opened in a copy window.",
      status,
    );
    return status;
  };

  window.sshAnimationBefore = (options = {}) => {
    const status = collectAnimationStatus(options);
    window.localStorage.setItem(
      "sprite-sheet-helper.animation-status-before-v1",
      JSON.stringify(status),
    );
    console.info(
      "[sshAnimationStatus] Captured before status. Change the in-place mode, then run window.sshAnimationAfter().",
      status,
    );
    return status;
  };

  window.sshAnimationAfter = async (options = {}) => {
    const beforeRaw = window.localStorage.getItem(
      "sprite-sheet-helper.animation-status-before-v1",
    );
    if (!beforeRaw) {
      throw new Error("No before status found. Run window.sshAnimationBefore() first.");
    }

    const before = JSON.parse(beforeRaw) as AnimationStatusSnapshot;
    const after = collectAnimationStatus(options);
    const report = {
      createdAt: new Date().toISOString(),
      before,
      after,
      diff: buildAnimationDiff(before, after),
    };

    window.localStorage.removeItem(
      "sprite-sheet-helper.animation-status-before-v1",
    );
    const copied = await copyText(JSON.stringify(report, null, 2));
    console.info(
      copied
        ? "[sshAnimationStatus] Before/after animation report copied."
        : "[sshAnimationStatus] Before/after animation report returned and opened in a copy window.",
      report,
    );
    return report;
  };

  window.sshForceAnimationInPlaceDebug = async (mode = "horizontal", options = {}) => {
    const before = collectAnimationStatus(options);
    const modelUuid = before.modelUuid;
    const animationName =
      options.animationName ??
      before.requestedAnimation ??
      before.clips[0]?.name;

    if (!animationName || animationName === "none") {
      throw new Error("No animation selected for debug force-in-place.");
    }

    useModelsStore
      .getState()
      .forceCurrentAnimationInPlace(modelUuid, animationName, mode);

    const after = collectAnimationStatus({ modelUuid, animationName });
    const report = {
      createdAt: new Date().toISOString(),
      mode,
      before,
      after,
      diff: buildAnimationDiff(before, after),
    };
    const copied = await copyText(JSON.stringify(report, null, 2));
    console.info(
      copied
        ? "[sshAnimationStatus] Force-in-place debug report copied."
        : "[sshAnimationStatus] Force-in-place debug report returned and opened in a copy window.",
      report,
    );
    return report;
  };
}
