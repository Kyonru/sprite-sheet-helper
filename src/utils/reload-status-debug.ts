import * as THREE from "three";
import { useCamerasStore } from "@/store/next/cameras";
import { useEntitiesStore } from "@/store/next/entities";
import { useLightsStore } from "@/store/next/lights";
import { useModelsStore } from "@/store/next/models";
import { useSettingsStore } from "@/store/next/settings";
import { useTransformsStore } from "@/store/next/transforms";
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

declare global {
  interface Window {
    sshReloadStatus: (
      options?: ReloadStatusDebugOptions,
    ) => Promise<ReloadStatusDebugSnapshot | unknown>;
    sshCopyStatus: () => Promise<ReloadStatusDebugSnapshot>;
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
}
