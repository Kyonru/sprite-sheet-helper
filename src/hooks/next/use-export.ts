import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { scheduleInterval } from "../../utils/time";
import { EventType, PubSub } from "../../lib/events";
import { useSceneStore } from "@/components/panels/scene/store";
import { useSettingsStore } from "@/store/next/settings";
import { useImagesStore } from "@/store/next/images";
import type { ExportFormat } from "@/types/file";
import { exporters } from "@/utils/exports";
import { buildZip } from "@/utils/exports/helpers";
import { downloadFile } from "@/utils/assets";

export const useExport = () => {
  const images = useRef<{ name: string; dataURL: string }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>(null);

  const intervals = useImagesStore((state) => state.intervals);
  const iterations = useImagesStore((state) => state.iterations);
  const frameDelay = useImagesStore((state) => state.fps);

  const exportFormat = useSettingsStore((state) => state.mode);

  const { exportHeight, exportWidth } = useSettingsStore();
  const addImages = useImagesStore((state) => state.addImagesRow);
  const addImageToRow = useImagesStore((state) => state.addImageToRow);
  const createEmptyRow = useImagesStore((state) => state.createEmptyRow);
  const selectedRow = useImagesStore((state) => state.selectedRow);
  const exportedImages = useImagesStore((state) => state.images);
  const lastIndex = useRef(0);

  const composer = useSceneStore((state) => state.composer);
  const { gl } = useThree();

  const captureScreenshotData = useCallback(() => {
    if (!gl || !composer) return;

    const originalSize = gl.getSize(new THREE.Vector2());
    const originalPixelRatio = gl.getPixelRatio();
    const originalTarget = gl.getRenderTarget();

    const target = new THREE.WebGLRenderTarget(exportWidth, exportHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    if (exportWidth && exportHeight) {
      gl.setSize(exportWidth, exportHeight, true);
    }
    gl.setRenderTarget(target);

    gl.setPixelRatio(1);
    composer.render();

    const base64Data = gl.domElement.toDataURL("image/png").split("base64,")[1];
    images.current.push({
      name: `image${images.current.length}.png`,
      dataURL: base64Data,
    });

    gl.setPixelRatio(originalPixelRatio);
    gl.setSize(originalSize.x, originalSize.y);
    gl.setRenderTarget(originalTarget);

    composer.render();
  }, [gl, exportWidth, composer, exportHeight]);

  const exportSpriteSheet = useCallback(
    async (format?: ExportFormat) => {
      const exportType = format ?? exportFormat;

      try {
        const exporter = exporters[exportType];
        if (!exporter) throw new Error(`Missing exporter: ${exportType}`);

        const result = await exporter.run({
          exportedImages,
          frameDelay,
        });

        const zipData = await buildZip((zip) => {
          for (const file of result.files) {
            zip.file(file.name, file.content, {
              base64: file.base64,
            });
          }
        });

        downloadFile("data:application/zip;base64," + zipData, result.filename);
      } catch (err) {
        console.error(err);
      } finally {
        PubSub.emit(EventType.STOP_EXPORT);
      }
    },
    [exportedImages, exportFormat, frameDelay],
  );

  const takeScreenshotSequence = useCallback(() => {
    if (!gl) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    images.current = [];

    intervalRef.current = scheduleInterval(
      captureScreenshotData,
      intervals,
      iterations,
      async () => {
        PubSub.emit(EventType.STOP_ASSETS_CREATION);

        addImages(
          Date.now().toString(),
          `animation_${lastIndex.current + 1}`,
          images.current.map((img) => img.dataURL),
          exportWidth,
          exportHeight,
          Math.round(1000 / intervals),
        );
        lastIndex.current += 1;
      },
    );
  }, [
    gl,
    intervals,
    iterations,
    addImages,
    captureScreenshotData,
    exportWidth,
    exportHeight,
  ]);

  const addScreenshot = useCallback(() => {
    if (!gl) return;

    images.current = [];

    captureScreenshotData();

    const row = useImagesStore.getState().images[selectedRow || 0];
    const width = row?.frameWidth || exportWidth;
    const height = row?.frameHeight || exportHeight;

    addImageToRow(
      selectedRow || 0,
      images.current[0].dataURL,
      width,
      height,
      Math.round(1000 / intervals),
    );
    images.current = [];
  }, [
    gl,
    intervals,
    selectedRow,
    exportWidth,
    exportHeight,
    addImageToRow,
    captureScreenshotData,
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
    PubSub.on(EventType.START_EXPORT, exportSpriteSheet);
    return () => {
      PubSub.off(EventType.START_EXPORT, exportSpriteSheet);
    };
  }, [exportSpriteSheet]);
};
