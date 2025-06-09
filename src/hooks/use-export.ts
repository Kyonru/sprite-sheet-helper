import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import JSZip from "jszip";
import { scheduleInterval } from "../utils/time";
import { EventType, PubSub } from "../lib/events";
import { useExportOptionsStore } from "../store/export";
import { createGif, createSpriteSheet, downloadFile } from "../utils/assets";
import { useFrameValues } from "../hooks/use-frame-values";
import { useEditorStore } from "@/store/editor";
import { useEffectsStore } from "@/store/effects";

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
    new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight)
  );
  const setShowEditor = useEditorStore((state) => state.setShowEditor);

  const intervals = useExportOptionsStore((state) => state.intervals);
  const iterations = useExportOptionsStore((state) => state.iterations);
  const frameDelay = useExportOptionsStore((state) => state.frameDelay);

  const setImages = useExportOptionsStore((state) => state.setImages);

  const composer = useEffectsStore((state) => state.composer);

  const { exportHeight, exportWidth } = useFrameValues();
  const { gl } = useThree();

  useEffect(() => {
    if (gl) {
      renderTarget.current = new THREE.WebGLRenderTarget(
        gl.domElement.width,
        gl.domElement.height
      );
    }
  }, [gl]);

  const captureScreenshotData = useCallback(() => {
    if (!gl || !composer) return;

    const originalSize = gl.getSize(new THREE.Vector2());
    const originalPixelRatio = gl.getPixelRatio();

    // Optional: upscale the output image
    if (exportWidth && exportHeight) {
      gl.setSize(exportWidth, exportHeight, true);
    }

    gl.setPixelRatio(1);

    // Render the postprocessed frame to the canvas
    composer.setSize(exportWidth, exportWidth, true);
    composer.render();

    // Capture the current canvas content as PNG
    const dataURL = gl.domElement.toDataURL("image/png");
    const base64Data = dataURL.split("base64,")[1];

    images.current.push({
      name: `image${images.current.length}.png`,
      dataURL: base64Data,
    });

    // Restore original size and pixel ratio
    gl.setPixelRatio(originalPixelRatio);
    gl.setSize(originalSize.x, originalSize.y);
    composer.setSize(originalSize.x, originalSize.y);
  }, [gl, composer, exportWidth, exportHeight, images]);

  const downloadImageFiles = useCallback(async () => {
    const zip = new JSZip();

    for (let i = 0; i < images.current.length; i++) {
      zip.file(images.current[i].name, images.current[i].dataURL, {
        base64: true,
      });
    }

    const zipData = await zip.generateAsync({ type: "base64" });

    downloadFile("data:application/zip;base64," + zipData, "images.zip");
  }, [images]);

  const exportSpriteSheet = useCallback(async () => {
    try {
      switch (exportFormat) {
        case "zip":
          await downloadImageFiles();
          break;
        case "spritesheet": {
          const dataUrl = await createSpriteSheet(
            images.current.map((img) => img.dataURL),
            "x",
            exportWidth,
            exportHeight
          );
          downloadFile(dataUrl, "spritesheet.png");
          break;
        }
        case "gif": {
          const gifUrl = await createGif(
            images.current.map((img) => img.dataURL),
            exportWidth,
            exportHeight,
            frameDelay
          );
          downloadFile(gifUrl, "spritesheet.gif");
          break;
        }
      }
    } catch (err) {
      console.error(err);
    }

    PubSub.emit(EventType.STOP_EXPORT);
  }, [
    exportFormat,
    exportWidth,
    exportHeight,
    frameDelay,
    downloadImageFiles,
    images,
  ]);

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
        console.log("Stopped taking screenshots.");
        PubSub.emit(EventType.STOP_ASSETS_CREATION);
        setShowEditor(true);
        setImages(images.current.map((img) => img.dataURL));
      }
    );
  }, [
    gl,
    intervals,
    iterations,
    setImages,
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
