import * as THREE from "three";
import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import JSZip from "jszip";
import { Selection } from "@react-three/postprocessing";
import {
  Grid,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  TransformControls,
} from "@react-three/drei";
import { scheduleInterval } from "../utils/time";
import { FileModel } from "../components/file-model";
import { EventType, PubSub } from "../lib/events";
import { useModelStore } from "../store/model";
import { useExportOptionsStore } from "../store/export";
import { PostProcessingEffects } from "../components/effects";
import { useCameraValues } from "../hooks/use-camera-values";
import { createSpriteSheet, downloadFile } from "../utils/assets";
import { Box } from "../components/box";
import { Lighting } from "../components/config/lights-config";
import { useFrameValues } from "../hooks/use-frame-values";
import { useEditorStore } from "@/store/editor";
import { useEffectsStore } from "@/store/effects";

const TransformAsset = () => {
  const showEditor = useEditorStore((state) => state.showEditor);
  const modelFile = useModelStore((state) => state.file);
  const scale = useModelStore((state) => state.scale);
  const position = useModelStore((state) => state.position);
  const rotation = useModelStore((state) => state.rotation);

  return (
    <TransformControls
      enabled={showEditor}
      mode="translate"
      showX={showEditor}
      showY={showEditor}
      showZ={showEditor}
    >
      {modelFile ? (
        <FileModel
          rotation={rotation}
          position={position}
          scale={scale}
          file={modelFile}
        />
      ) : (
        <Box />
      )}
    </TransformControls>
  );
};

export const AssetScene = () => {
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
  const showEditor = useEditorStore((state) => state.showEditor);
  const setShowEditor = useEditorStore((state) => state.setShowEditor);

  const intervals = useExportOptionsStore((state) => state.intervals);
  const iterations = useExportOptionsStore((state) => state.iterations);

  const composer = useEffectsStore((state) => state.composer);

  const { exportHeight, exportWidth } = useFrameValues();
  const { gl } = useThree();

  const {
    position: cameraPosition,
    zoom,
    fov,
    type: cameraType,
  } = useCameraValues();

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

    // Resize renderer to custom size
    gl.setSize(exportWidth, exportHeight);
    gl.setPixelRatio(1); // Optional: 1:1 pixel ratio for sharp output
    composer.setSize(exportWidth, exportHeight);

    // Render with postprocessing
    composer.render();

    const dataURL = gl.domElement.toDataURL(
      `image_${images.current.length}/png`
    );
    const idx = dataURL.indexOf("base64,") + "base64,".length;
    const content = dataURL.substring(idx);

    images.current.push({
      name: "image" + images.current.length + ".png",
      dataURL: content,
    });

    gl.setPixelRatio(originalPixelRatio);
    gl.setSize(originalSize.x, originalSize.y);
    composer.setSize(originalSize.x, originalSize.y);
  }, [images, gl, exportWidth, exportHeight, composer]);

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
        setShowEditor(true);

        if (exportFormat === "zip") {
          await downloadImageFiles();
        } else {
          const dataUrl = await createSpriteSheet(
            images.current.map((img) => img.dataURL)
          );
          downloadFile(dataUrl, "spritesheet.png");
        }
      }
    );
  }, [
    exportFormat,
    gl,
    intervals,
    iterations,
    downloadImageFiles,
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

  return (
    <>
      <Lighting />
      <Selection>
        <PostProcessingEffects />
        {cameraType === "orthographic" ? (
          <OrthographicCamera
            makeDefault={true}
            position={cameraPosition}
            zoom={zoom}
          />
        ) : (
          <PerspectiveCamera
            makeDefault={true}
            position={cameraPosition}
            fov={fov}
            zoom={zoom}
          />
        )}
        <TransformAsset />
      </Selection>
      <OrbitControls enabled={showEditor} makeDefault />

      {showEditor && (
        <Grid
          visible={showEditor}
          fadeDistance={25}
          infiniteGrid
          sectionColor={"#a09f9f"}
          cellColor={"#868686"}
        />
      )}
    </>
  );
};
