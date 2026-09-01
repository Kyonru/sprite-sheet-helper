import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useModelsStore } from "@/store/next/models";
import {
  getCaptureCycleSeconds,
  wrapCaptureTime,
} from "@/utils/capture-timing";
import { waitForStable } from "@/utils/capture-settle";
import {
  EventType,
  PubSub,
  type CaptureStartPayload,
  type StartExportPayload,
} from "../../lib/events";
import { useSceneStore } from "@/components/panels/scene/store";
import { useSettingsStore } from "@/store/next/settings";
import { useImagesStore } from "@/store/next/images";
import { useSpritePostprocessStore } from "@/store/next/sprite-postprocess";
import { useEntitiesStore } from "@/store/next/entities";
import type { ExportFormat } from "@/types/file";
import { exporters } from "@/utils/exports";
import {
  buildZip,
  fpsFromCaptureInterval,
  getNormalCoverage,
} from "@/utils/exports/helpers";
import { downloadFile } from "@/utils/assets";
import { toast } from "sonner";
import { normalizeAtlasOptions } from "@/utils/atlas";
import {
  getExportSummary,
  validateExportRequest,
} from "@/utils/export-validation";
import { addExportHistoryEntry } from "@/utils/export-history";
import { getActiveAnimationSequenceLabel } from "@/utils/animation-sequence-label";

const NORMAL_MAP_EXPORT_FORMATS = new Set<ExportFormat>([
  "spritesheet",
  "love2d-lua",
  "love2d-anim8",
  "turbo",
  "bevy",
  "phaser",
  "godot",
  "pygame",
  "raylib",
  "unity",
]);

const nextAnimationFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Wait until the view has stopped moving.
 *
 * The camera is set through the store and an event, and the controls apply it
 * on one of the following frames — so a capture that starts immediately can
 * record its first frame from the previous step's angle. The wait is on the
 * camera's own transform rather than a frame count, so it holds regardless of
 * how loaded the machine is.
 */
async function waitForStableCamera(camera: THREE.Camera): Promise<boolean> {
  return waitForStable({
    sample: () => {
      camera.updateMatrixWorld();
      return camera.matrixWorld.clone();
    },
    equals: (a, b) => a.equals(b),
    waitFrame: nextAnimationFrame,
  });
}

function getAnimationCycles(): Record<string, number> {
  const { models, animations, clips, durations, speeds } =
    useModelsStore.getState();
  const cycles: Record<string, number> = {};

  for (const uuid of Object.keys(models)) {
    const animation = animations[uuid];
    if (!animation || animation === "none") continue;

    const clip = clips[uuid]?.find(
      (entry) => entry.clip.name === animation,
    )?.clip;
    if (!clip) continue;

    cycles[uuid] = getCaptureCycleSeconds({
      duration: clip.duration,
      trim: durations[uuid]?.[animation],
      speed: speeds[uuid]?.[animation],
    });
  }

  return cycles;
}

/**
 * Drive every model's animation to an exact time.
 *
 * `setTime` applies the pose immediately, so the very next render shows it. The
 * mixers must be frozen first or the render loop's own `mixer.update(delta)`
 * would advance them again between the seek and the grab.
 *
 * Times past the end of a clip wrap into it rather than running off the end,
 * where a `LoopOnce` action stops evaluating and every remaining frame holds
 * one pose.
 */
function seekAllAnimations(
  timeSeconds: number,
  cycles: Record<string, number>,
) {
  const { mixerRef } = useModelsStore.getState();

  for (const [uuid, mixer] of Object.entries(mixerRef)) {
    mixer?.setTime(wrapCaptureTime(timeSeconds, cycles[uuid] ?? 0));
  }
}

function setAllAnimationsFrozen(frozen: boolean): Record<string, boolean> {
  const { models, freeze, setFreeze } = useModelsStore.getState();
  const previous: Record<string, boolean> = {};

  for (const uuid of Object.keys(models)) {
    previous[uuid] = freeze[uuid] ?? false;
    setFreeze(uuid, frozen);
  }

  return previous;
}

function restoreAnimationFreeze(previous: Record<string, boolean>) {
  const { setFreeze } = useModelsStore.getState();
  for (const [uuid, frozen] of Object.entries(previous)) {
    setFreeze(uuid, frozen);
  }
}

function getCaptureTiming(
  payload: CaptureStartPayload | null | undefined,
  defaults: {
    intervalMs: number;
    frameCount: number;
  },
) {
  return {
    intervalMs: Math.max(
      1,
      Math.round(
        Number.isFinite(payload?.frameIntervalMs)
          ? (payload?.frameIntervalMs ?? defaults.intervalMs)
          : defaults.intervalMs,
      ),
    ),
    frameCount: Math.max(
      1,
      Math.round(
        Number.isFinite(payload?.frameCount)
          ? (payload?.frameCount ?? defaults.frameCount)
          : defaults.frameCount,
      ),
    ),
  };
}

export const useExport = () => {
  const images = useRef<{ name: string; dataURL: string }[]>([]);
  const normalImages = useRef<{ name: string; dataURL: string }[]>([]);
  /** The in-flight capture, so a cancel can stop the loop between frames. */
  const captureRunRef = useRef<{ cancelled: boolean } | null>(null);
  const activeCaptureRef = useRef<CaptureStartPayload | null>(null);
  const normalMaterialRef = useRef<THREE.MeshNormalMaterial | null>(null);

  const intervals = useImagesStore((state) => state.intervals);
  const iterations = useImagesStore((state) => state.iterations);
  const frameDelay = useImagesStore((state) => state.fps);

  const exportFormat = useSettingsStore((state) => state.mode);
  const exportNormalMap = useSettingsStore((state) => state.exportNormalMap);
  const atlasLayout = useSettingsStore((state) => state.atlasLayout);
  const atlasPadding = useSettingsStore((state) => state.atlasPadding);
  const atlasBleed = useSettingsStore((state) => state.atlasBleed);
  const atlasSpriteMargin = useSettingsStore(
    (state) => state.atlasSpriteMargin,
  );
  const atlasScale = useSettingsStore((state) => state.atlasScale);
  const maxAtlasSize = useSettingsStore((state) => state.maxAtlasSize);
  const allowMultiPage = useSettingsStore((state) => state.allowMultiPage);

  const { exportHeight, exportWidth } = useSettingsStore();
  const addImages = useImagesStore((state) => state.addImagesRow);
  const addImageToRow = useImagesStore((state) => state.addImageToRow);
  const createEmptyRow = useImagesStore((state) => state.createEmptyRow);
  const selectedRow = useImagesStore((state) => state.selectedRow);
  const exportedImages = useImagesStore((state) => state.images);
  const lastIndex = useRef(0);

  const composer = useSceneStore((state) => state.composer);
  const { gl, scene, camera } = useThree();

  const captureScreenshotData = useCallback(() => {
    if (!gl || !composer) return;

    const originalSize = gl.getSize(new THREE.Vector2());
    const originalPixelRatio = gl.getPixelRatio();
    const originalTarget = gl.getRenderTarget();
    const originalClearColor = gl.getClearColor(new THREE.Color());
    const originalClearAlpha = gl.getClearAlpha();
    const originalBackground = scene.background;
    const originalOverrideMaterial = scene.overrideMaterial;

    try {
      gl.setPixelRatio(1);
      composer.setSize(
        exportWidth || originalSize.x,
        exportHeight || originalSize.y,
        true,
      );
      gl.setRenderTarget(null);

      composer.render();

      const base64Data = gl.domElement
        .toDataURL("image/png")
        .split("base64,")[1];
      images.current.push({
        name: `image${images.current.length}.png`,
        dataURL: base64Data,
      });

      if (exportNormalMap) {
        if (!normalMaterialRef.current) {
          normalMaterialRef.current = new THREE.MeshNormalMaterial({
            transparent: true,
          });
        }

        scene.background = null;
        scene.overrideMaterial = normalMaterialRef.current;
        gl.setClearColor("#000000", 0);
        gl.clear(true, true, true);
        gl.render(scene, camera);

        const normalBase64Data = gl.domElement
          .toDataURL("image/png")
          .split("base64,")[1];
        normalImages.current.push({
          name: `normal${normalImages.current.length}.png`,
          dataURL: normalBase64Data,
        });
      }
    } finally {
      scene.background = originalBackground;
      scene.overrideMaterial = originalOverrideMaterial;
      gl.setClearColor(originalClearColor, originalClearAlpha);
      gl.setPixelRatio(originalPixelRatio);
      composer.setSize(originalSize.x, originalSize.y, true);
      gl.setRenderTarget(originalTarget);

      composer.render();
    }
  }, [
    gl,
    scene,
    camera,
    exportWidth,
    composer,
    exportHeight,
    exportNormalMap,
  ]);

  const exportSpriteSheet = useCallback(
    async (payload?: StartExportPayload) => {
      const exportType =
        typeof payload === "string"
          ? payload
          : (payload?.format ?? exportFormat);
      const storeAtlasOptions = {
        layout: atlasLayout,
        padding: atlasPadding,
        extrude: atlasBleed,
        spriteMargin: atlasSpriteMargin,
        scale: atlasScale,
        maxAtlasSize,
        allowMultiPage,
      };
      const atlasOptions = normalizeAtlasOptions(
        typeof payload === "object"
          ? { ...storeAtlasOptions, ...payload.atlasOptions }
          : storeAtlasOptions,
      );
      const validation = validateExportRequest({
        rows: exportedImages,
        format: exportType,
        includeNormalMap: exportNormalMap,
        atlasOptions,
      });

      if (validation.blocking) {
        toast.error("Export blocked", {
          description:
            validation.messages.find((message) => message.severity === "error")
              ?.message ?? "Fix export validation errors before exporting.",
        });
        PubSub.emit(EventType.STOP_EXPORT);
        return;
      }

      try {
        const exporter = exporters[exportType];
        if (!exporter) throw new Error(`Missing exporter: ${exportType}`);

        const result = await exporter.run({
          exportedImages,
          frameDelay,
          includeNormalMap: exportNormalMap,
          atlasOptions,
          spritePostprocess:
            typeof payload === "object"
              ? payload.spritePostprocess
              : useSpritePostprocessStore.getState().getSnapshot(),
        });

        if (exportNormalMap && NORMAL_MAP_EXPORT_FORMATS.has(exportType)) {
          const coverage = getNormalCoverage(exportedImages);
          if (coverage.totalFrames > 0 && coverage.normalFrames === 0) {
            toast.warning("Normal atlas uses placeholder frames", {
              description:
                "No captured frames have normal maps. Turn on Capture normal maps before recording or adding frames, then recapture for real normal data.",
            });
          } else if (coverage.missingFrames > 0) {
            toast.warning("Normal atlas has placeholder frames", {
              description: `${coverage.missingFrames} of ${coverage.totalFrames} frames are missing captured normals. Recapture those frames with Capture normal maps enabled for complete normal data.`,
            });
          }
        }

        const zipData = await buildZip((zip) => {
          for (const file of result.files) {
            zip.file(file.name, file.content, {
              base64: file.base64,
            });
          }
        });

        downloadFile("data:application/zip;base64," + zipData, result.filename);
        const summary = getExportSummary(exportedImages, atlasOptions);
        addExportHistoryEntry({
          format: exportType,
          filename: result.filename,
          frameCount: summary.frameCount,
          animationCount: summary.animationCount,
          pageCount: summary.pageCount,
          normalStatus: summary.normalStatus,
          atlasOptions,
          messages: validation.messages,
        });
      } catch (err) {
        console.error(err);
        toast.error("Export failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        PubSub.emit(EventType.STOP_EXPORT);
      }
    },
    [
      allowMultiPage,
      atlasBleed,
      atlasSpriteMargin,
      atlasLayout,
      atlasPadding,
      atlasScale,
      exportedImages,
      exportFormat,
      frameDelay,
      exportNormalMap,
      maxAtlasSize,
    ],
  );

  /**
   * Capture a sequence by stepping animation time, not by watching the clock.
   *
   * The old loop was a `setInterval` that grabbed whatever the render loop
   * happened to be showing, so a frame's pose was decided by how busy the
   * browser was: measured spacing between two frames requested 16ms apart
   * ranged from 0ms (the same pose twice) to 236ms of animation, while the
   * exported row still claimed the rate that had been asked for. Seeking to
   * `frame × interval` instead makes the frames exactly as far apart as the
   * manifest says, on any machine, at any size — and identical between runs.
   *
   * The pattern is the one the auto-fit measure phase and the CLI's turntable
   * capture already use.
   */
  const takeScreenshotSequence = useCallback(
    async (payload?: CaptureStartPayload) => {
      if (!gl) return;

      const modelState = useModelsStore.getState();
      const sequenceLabel =
        payload?.label ??
        getActiveAnimationSequenceLabel({
          animations: modelState.animations,
          clips: modelState.clips,
          selectedUuid: useEntitiesStore.getState().selected,
        }) ??
        `animation_${lastIndex.current + 1}`;
      const capturePayload = { ...(payload ?? {}), label: sequenceLabel };
      const captureTiming = getCaptureTiming(capturePayload, {
        intervalMs: intervals,
        frameCount: iterations,
      });

      images.current = [];
      normalImages.current = [];
      activeCaptureRef.current = capturePayload;
      const run = { cancelled: false };
      captureRunRef.current = run;

      const previousFreeze = setAllAnimationsFrozen(true);
      if (!(await waitForStableCamera(camera))) {
        console.debug(
          "[capture] camera still moving when the sequence started:",
          capturePayload.label,
        );
      }
      const cycles = getAnimationCycles();
      const stepSeconds = captureTiming.intervalMs / 1000;

      try {
        for (let frame = 0; frame < captureTiming.frameCount; frame += 1) {
          if (run.cancelled) return;

          seekAllAnimations(frame * stepSeconds, cycles);
          // One frame for the scene to render the pose that was just applied,
          // and for progress to reach the screen. It costs wall-clock time but
          // not correctness — the pose is already pinned.
          await nextAnimationFrame();
          if (run.cancelled) return;

          captureScreenshotData();

          PubSub.emit(EventType.ASSETS_CREATION_PROGRESS, {
            label: capturePayload.label,
            workflowRunId: capturePayload.workflowRunId,
            capturedFrames: images.current.length,
            expectedFrames: captureTiming.frameCount,
          });
        }
      } finally {
        restoreAnimationFreeze(previousFreeze);
        if (captureRunRef.current === run) captureRunRef.current = null;
      }

      if (run.cancelled) return;

      PubSub.emit(EventType.STOP_ASSETS_CREATION, {
        label: capturePayload.label,
        workflowRunId: capturePayload.workflowRunId,
        capturedFrames: images.current.length,
        expectedFrames: captureTiming.frameCount,
        status: "done",
      });
      activeCaptureRef.current = null;

      addImages(
        Date.now().toString(),
        capturePayload.label,
        images.current.map((img) => img.dataURL),
        exportNormalMap
          ? normalImages.current.map((img) => img.dataURL)
          : undefined,
        exportWidth,
        exportHeight,
        fpsFromCaptureInterval(captureTiming.intervalMs),
        capturePayload.rowMetadata,
      );
      lastIndex.current += 1;
    },
    [
      gl,
      camera,
      intervals,
      iterations,
      addImages,
      captureScreenshotData,
      exportWidth,
      exportHeight,
      exportNormalMap,
    ],
  );

  const cancelScreenshotSequence = useCallback(() => {
    if (!captureRunRef.current && !activeCaptureRef.current) return;

    if (captureRunRef.current) {
      captureRunRef.current.cancelled = true;
      captureRunRef.current = null;
    }

    const payload = activeCaptureRef.current;
    const captureTiming = getCaptureTiming(payload, {
      intervalMs: intervals,
      frameCount: iterations,
    });
    PubSub.emit(EventType.STOP_ASSETS_CREATION, {
      label: payload?.label,
      workflowRunId: payload?.workflowRunId,
      capturedFrames: images.current.length,
      expectedFrames: captureTiming.frameCount,
      status: "cancelled",
    });

    activeCaptureRef.current = null;
    images.current = [];
    normalImages.current = [];
  }, [intervals, iterations]);

  const addScreenshot = useCallback(() => {
    if (!gl) return;

    images.current = [];
    normalImages.current = [];

    captureScreenshotData();

    const row = useImagesStore.getState().images[selectedRow || 0];
    const width = row?.frameWidth || exportWidth;
    const height = row?.frameHeight || exportHeight;

    addImageToRow(
      selectedRow || 0,
      images.current[0].dataURL,
      exportNormalMap ? normalImages.current[0]?.dataURL : undefined,
      width,
      height,
      fpsFromCaptureInterval(intervals),
    );
    images.current = [];
    normalImages.current = [];
  }, [
    gl,
    intervals,
    selectedRow,
    exportWidth,
    exportHeight,
    addImageToRow,
    captureScreenshotData,
    exportNormalMap,
  ]);

  useEffect(() => {
    PubSub.on(EventType.TAKE_SINGLE_SCREENSHOT, addScreenshot);

    return () => {
      PubSub.off(EventType.TAKE_SINGLE_SCREENSHOT, addScreenshot);
    };
  }, [addScreenshot]);

  const onNewRow = useCallback(() => {
    createEmptyRow(exportWidth, exportHeight, fpsFromCaptureInterval(intervals));
  }, [createEmptyRow, exportWidth, exportHeight, intervals]);

  useEffect(() => {
    PubSub.on(EventType.NEW_SEQUENCE, onNewRow);

    return () => {
      PubSub.off(EventType.NEW_SEQUENCE, onNewRow);
    };
  }, [onNewRow]);

  useEffect(() => {
    PubSub.on(EventType.START_ASSETS_CREATION, takeScreenshotSequence);
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, takeScreenshotSequence);
    };
  }, [takeScreenshotSequence]);

  useEffect(() => {
    PubSub.on(EventType.CANCEL_ASSETS_CREATION, cancelScreenshotSequence);
    return () => {
      PubSub.off(EventType.CANCEL_ASSETS_CREATION, cancelScreenshotSequence);
    };
  }, [cancelScreenshotSequence]);

  useEffect(() => {
    PubSub.on(EventType.START_EXPORT, exportSpriteSheet);
    return () => {
      PubSub.off(EventType.START_EXPORT, exportSpriteSheet);
    };
  }, [exportSpriteSheet]);

  useEffect(() => {
    return () => {
      normalMaterialRef.current?.dispose();
    };
  }, []);
};
