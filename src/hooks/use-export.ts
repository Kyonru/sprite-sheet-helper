import * as THREE from "three";
import { useCallback, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import JSZip from "jszip";
import { scheduleInterval } from "../utils/time";
import { EventType, PubSub } from "../lib/events";
import { useExportOptionsStore } from "../store/export";
import { createGif, createSpriteSheet, downloadFile } from "../utils/assets";
import { useFrameValues } from "../hooks/use-frame-values";
import { useEditorStore } from "@/store/editor";
import { useEffectsStore } from "@/store/effects";
import { useModelStore } from "@/store/model";

export const useExport = () => {
  const images = useRef<
    {
      name: string;
      dataURL: string;
    }[]
  >([]);
  const intervalRef = useRef<NodeJS.Timeout>(null);
  const exportFormat = useExportOptionsStore((state) => state.mode);
  const renderTarget = useRef<THREE.WebGLRenderTarget | null>(
    new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    }),
  );
  const setShowEditor = useEditorStore((state) => state.setShowEditor);

  const intervals = useExportOptionsStore((state) => state.intervals);
  const iterations = useExportOptionsStore((state) => state.iterations);
  const frameDelay = useExportOptionsStore((state) => state.frameDelay);

  const addImages = useExportOptionsStore((state) => state.addImagesRow);
  const exportedImages = useExportOptionsStore((state) => state.images);
  const exportLabel = useExportOptionsStore((state) => state.label);
  const setExportLabel = useExportOptionsStore((state) => state.setLabel);

  const animation = useModelStore((state) => state.animation);

  const composer = useEffectsStore((state) => state.composer);
  const [exportedImagesCount, setExportedImagesCount] = useState(0);

  const { exportHeight, exportWidth } = useFrameValues();
  const { gl } = useThree();

  useEffect(() => {
    if (gl) {
      renderTarget.current = new THREE.WebGLRenderTarget(
        gl.domElement.width,
        gl.domElement.height,
        {
          minFilter: THREE.NearestFilter,
          magFilter: THREE.NearestFilter,
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType,
        },
      );
    }
  }, [gl]);

  const captureScreenshotData = useCallback(() => {
    if (!gl || !composer) return;

    const target = new THREE.WebGLRenderTarget(exportWidth, exportHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    const originalSize = gl.getSize(new THREE.Vector2());
    const originalPixelRatio = gl.getPixelRatio();
    const originalTarget = gl.getRenderTarget();

    gl.setPixelRatio(1);
    gl.setSize(exportWidth, exportHeight, true);
    composer.setSize(exportWidth, exportHeight);
    composer.render();

    // Read pixels directly from the render target — no browser scaling involved
    const pixels = new Uint8Array(exportWidth * exportHeight * 4);
    gl.setRenderTarget(target);
    gl.readRenderTargetPixels(target, 0, 0, exportWidth, exportHeight, pixels);
    gl.setRenderTarget(originalTarget);

    // Blit to a 2D canvas with smoothing off
    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;

    // WebGL reads bottom-to-top — flip vertically
    const imageData = ctx.createImageData(exportWidth, exportHeight);
    for (let row = 0; row < exportHeight; row++) {
      const src = (exportHeight - row - 1) * exportWidth * 4;
      const dst = row * exportWidth * 4;
      imageData.data.set(pixels.subarray(src, src + exportWidth * 4), dst);
    }
    ctx.putImageData(imageData, 0, 0);

    const base64Data = canvas.toDataURL("image/png").split("base64,")[1];
    images.current.push({
      name: `image${images.current.length}.png`,
      dataURL: base64Data,
    });

    target.dispose();
    gl.setPixelRatio(originalPixelRatio);
    gl.setSize(originalSize.x, originalSize.y);
    composer.setSize(originalSize.x, originalSize.y);
    composer.render();
  }, [gl, composer, exportWidth, exportHeight]);

  const downloadImageFiles = useCallback(async () => {
    const zip = new JSZip();

    for (let i = 0; i < exportedImages.length; i++) {
      const folder = zip.folder(exportedImages[i].label)!;

      for (let j = 0; j < exportedImages[i].images.length; j++) {
        folder.file(
          `${exportedImages[i].name}_${j}.png`,
          exportedImages[i].images[j],
          {
            base64: true,
          },
        );
      }
    }

    const zipData = await zip.generateAsync({ type: "base64" });

    downloadFile("data:application/zip;base64," + zipData, "images.zip");
  }, [exportedImages]);

  const downloadGifFiles = useCallback(async () => {
    const zip = new JSZip();

    for (let i = 0; i < exportedImages.length; i++) {
      const gifUrl = await createGif(
        exportedImages[i].images,
        exportWidth,
        exportHeight,
        frameDelay,
      );

      const content = await (await fetch(gifUrl)).arrayBuffer();
      zip.file(`${exportedImages[i].name}.gif`, content);
    }

    const zipData = await zip.generateAsync({ type: "base64" });

    downloadFile("data:application/zip;base64," + zipData, "gif.zip");
  }, [exportedImages, exportWidth, exportHeight, frameDelay]);

  const downloadSpriteSheet = useCallback(async () => {
    const dataUrl = await createSpriteSheet(
      exportedImages.map((img) => img.images),
      exportWidth,
      exportHeight,
    );
    await downloadFile(dataUrl, "spritesheet.png");
  }, [exportedImages, exportWidth, exportHeight]);

  const exportSpriteSheet = useCallback(async () => {
    try {
      switch (exportFormat) {
        case "zip": {
          await downloadImageFiles();
          break;
        }
        case "spritesheet": {
          await downloadSpriteSheet();
          break;
        }
        case "gif": {
          await downloadGifFiles();
          break;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      PubSub.emit(EventType.STOP_EXPORT);
    }
  }, [exportFormat, downloadSpriteSheet, downloadGifFiles, downloadImageFiles]);

  const takeScreenshot = useCallback(() => {
    if (!gl) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setShowEditor(false);

    images.current = [];
    console.log("Taking screenshots...");

    intervalRef.current = scheduleInterval(
      captureScreenshotData,
      intervals,
      iterations,
      async () => {
        PubSub.emit(EventType.STOP_ASSETS_CREATION);
        setShowEditor(true);
        addImages(
          animation || Date.now().toString(),
          exportLabel,
          images.current.map((img) => img.dataURL),
        );
        setExportLabel(`animation_${exportedImagesCount + 1}`);
        setExportedImagesCount(exportedImagesCount + 1);
      },
    );
  }, [
    gl,
    intervals,
    iterations,
    animation,
    exportLabel,
    exportedImagesCount,
    setExportLabel,
    addImages,
    captureScreenshotData,
    setShowEditor,
  ]);

  useEffect(() => {
    PubSub.on(EventType.START_ASSETS_CREATION, takeScreenshot);

    // Clean up the subscription when the component unmounts
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, takeScreenshot);
    };
  }, [takeScreenshot]);

  useEffect(() => {
    PubSub.on(EventType.START_EXPORT, exportSpriteSheet);

    // Clean up the subscription when the component unmounts
    return () => {
      PubSub.off(EventType.START_EXPORT, exportSpriteSheet);
    };
  }, [exportSpriteSheet]);
};
