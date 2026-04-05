import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import JSZip from "jszip";
import { scheduleInterval } from "../../utils/time";
import { EventType, PubSub } from "../../lib/events";
import {
  createGif,
  createSpriteSheet,
  createSpritesheetJSON,
  downloadFile,
} from "../../utils/assets";
import { useSceneStore } from "@/components/panels/scene/store";
import { useSettingsStore } from "@/store/next/settings";
import { useImagesStore } from "@/store/next/images";
import { toast } from "sonner";
import type { ExportFormat } from "@/types/file";

export const useExport = () => {
  const images = useRef<{ name: string; dataURL: string }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>(null);

  const intervals = useImagesStore((state) => state.intervals);
  const iterations = useImagesStore((state) => state.iterations);
  const frameDelay = useImagesStore((state) => state.fps);

  const exportFormat = useSettingsStore((state) => state.mode);

  const { exportHeight, exportWidth } = useSettingsStore();
  const addImages = useImagesStore((state) => state.addImagesRow);
  const exportedImages = useImagesStore((state) => state.images);

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

  const downloadImageFiles = useCallback(async () => {
    const zip = new JSZip();
    for (const row of exportedImages) {
      const folder = zip.folder(row.label)!;
      row.images.forEach((img, j) => {
        folder.file(`${row.uuid}_${j}.png`, img, { base64: true });
      });
    }
    const zipData = await zip.generateAsync({ type: "base64" });
    downloadFile("data:application/zip;base64," + zipData, "images.zip");
  }, [exportedImages]);

  const downloadGifFiles = useCallback(async () => {
    const zip = new JSZip();
    for (const row of exportedImages) {
      const gifUrl = await createGif(
        row.images,
        row.frameWidth,
        row.frameHeight,
        frameDelay,
      );
      const content = await (await fetch(gifUrl)).arrayBuffer();
      zip.file(`${row.uuid}.gif`, content);
    }
    const zipData = await zip.generateAsync({ type: "base64" });
    downloadFile("data:application/zip;base64," + zipData, "gif.zip");
  }, [exportedImages, frameDelay]);

  const downloadSpriteSheet = useCallback(async () => {
    const dataUrl = await createSpriteSheet(exportedImages);
    const json = createSpritesheetJSON(exportedImages);

    const zip = new JSZip();

    const base64PNG = dataUrl.split("base64,")[1];
    zip.file("spritesheet.png", base64PNG, { base64: true });

    zip.file("spritesheet.json", JSON.stringify(json, null, 2));

    const zipData = await zip.generateAsync({ type: "base64" });
    downloadFile("data:application/zip;base64," + zipData, "spritesheet.zip");
  }, [exportedImages]);

  const exportSpriteSheet = useCallback(
    async (format?: ExportFormat) => {
      const exportType = format || exportFormat;

      try {
        switch (exportType) {
          case "zip":
            await downloadImageFiles();
            break;
          case "spritesheet":
            await downloadSpriteSheet();
            break;
          case "gif":
            await downloadGifFiles();
            break;
        }
      } catch (err) {
        console.error(err);
      } finally {
        PubSub.emit(EventType.STOP_EXPORT);
        toast.success("Export complete", {
          description: "Check the downloaded files in the Downloads folder.",
        });
      }
    },
    [exportFormat, downloadImageFiles, downloadSpriteSheet, downloadGifFiles],
  );

  const takeScreenshot = useCallback(() => {
    if (!gl) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    images.current = [];

    intervalRef.current = scheduleInterval(
      captureScreenshotData,
      intervals,
      iterations,
      async () => {
        PubSub.emit(EventType.STOP_ASSETS_CREATION);

        const count = useImagesStore.getState().images.length;
        addImages(
          Date.now().toString(),
          `animation_${count + 1}`,
          images.current.map((img) => img.dataURL),
          exportWidth,
          exportHeight,
          Math.round(1000 / intervals),
        );
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

  useEffect(() => {
    PubSub.on(EventType.START_ASSETS_CREATION, takeScreenshot);
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, takeScreenshot);
    };
  }, [takeScreenshot]);

  useEffect(() => {
    PubSub.on(EventType.START_EXPORT, exportSpriteSheet);
    return () => {
      PubSub.off(EventType.START_EXPORT, exportSpriteSheet);
    };
  }, [exportSpriteSheet]);
};
