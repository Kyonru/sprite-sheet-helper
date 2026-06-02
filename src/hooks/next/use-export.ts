import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { scheduleInterval } from "../../utils/time";
import {
  EventType,
  PubSub,
  type CaptureStartPayload,
  type StartExportPayload,
} from "../../lib/events";
import { useSceneStore } from "@/components/panels/scene/store";
import { useSettingsStore } from "@/store/next/settings";
import { useImagesStore } from "@/store/next/images";
import type { ExportFormat } from "@/types/file";
import { exporters } from "@/utils/exports";
import { buildZip, getNormalCoverage } from "@/utils/exports/helpers";
import { downloadFile } from "@/utils/assets";
import { toast } from "sonner";
import { normalizeAtlasOptions } from "@/utils/atlas";
import {
  getExportSummary,
  validateExportRequest,
} from "@/utils/export-validation";
import { addExportHistoryEntry } from "@/utils/export-history";

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

export const useExport = () => {
  const images = useRef<{ name: string; dataURL: string }[]>([]);
  const normalImages = useRef<{ name: string; dataURL: string }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>(null);
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
      if (exportWidth && exportHeight) {
        gl.setSize(exportWidth, exportHeight, true);
      }
      gl.setPixelRatio(1);
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
      gl.setSize(originalSize.x, originalSize.y);
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

  const takeScreenshotSequence = useCallback(
    (payload?: CaptureStartPayload) => {
      if (!gl) return;
      if (intervalRef.current) clearInterval(intervalRef.current);

      images.current = [];
      normalImages.current = [];
      activeCaptureRef.current = payload ?? {};

      intervalRef.current = scheduleInterval(
        captureScreenshotData,
        intervals,
        iterations,
        () => {
          PubSub.emit(EventType.ASSETS_CREATION_PROGRESS, {
            label: payload?.label,
            workflowRunId: payload?.workflowRunId,
            capturedFrames: images.current.length,
            expectedFrames: iterations,
          });
        },
        async () => {
          intervalRef.current = null;
          PubSub.emit(EventType.STOP_ASSETS_CREATION, {
            label: payload?.label,
            workflowRunId: payload?.workflowRunId,
            capturedFrames: images.current.length,
            expectedFrames: iterations,
            status: "done",
          });
          activeCaptureRef.current = null;

          addImages(
            Date.now().toString(),
            payload?.label ?? `animation_${lastIndex.current + 1}`,
            images.current.map((img) => img.dataURL),
            exportNormalMap
              ? normalImages.current.map((img) => img.dataURL)
              : undefined,
            exportWidth,
            exportHeight,
            Math.round(1000 / intervals),
          );
          lastIndex.current += 1;
        },
      );
    },
    [
      gl,
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
    if (!intervalRef.current && !activeCaptureRef.current) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const payload = activeCaptureRef.current;
    PubSub.emit(EventType.STOP_ASSETS_CREATION, {
      label: payload?.label,
      workflowRunId: payload?.workflowRunId,
      capturedFrames: images.current.length,
      expectedFrames: iterations,
      status: "cancelled",
    });

    activeCaptureRef.current = null;
    images.current = [];
    normalImages.current = [];
  }, [iterations]);

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
      Math.round(1000 / intervals),
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
    createEmptyRow(exportWidth, exportHeight, Math.round(1000 / intervals));
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
