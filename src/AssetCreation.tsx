import "./App.css";
import * as THREE from "three";
import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import JSZip from "jszip";
import { folder, useControls } from "leva";
import { Selection } from "@react-three/postprocessing";
import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import { scheduleInterval } from "./utils/time";
import { FileModel } from "./components/file-model";
import { EventType, PubSub } from "./lib/events";
import { useModelStore } from "./store/model";
import { useExportOptionsStore } from "./store/export";
import { PostProcessingEffects } from "./components/effects";
import { useCameraValues } from "./hooks/use-camera-values";
import { createSpritesheet, downloadFile } from "./utils/assets";
import { Box } from "./components/box";

function AssetCreation() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [gl, setGl] = useState<THREE.WebGLRenderer>();

  const images = useRef<
    {
      name: string;
      dataURL: string;
    }[]
  >([]);
  const intervalRef = useRef<NodeJS.Timeout>(null);
  const exportFormat = useExportOptionsStore((state) => state.mode);
  const modelFile = useModelStore((state) => state.file);
  const renderTarget = useRef<THREE.WebGLRenderTarget | null>(
    new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight)
  );

  const scale = useModelStore((state) => state.scale);
  const position = useModelStore((state) => state.position);
  const rotation = useModelStore((state) => state.rotation);
  const intervals = useExportOptionsStore((state) => state.intervals);
  const iterations = useExportOptionsStore((state) => state.iterations);

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
    if (!gl) return;

    const dataURL = gl.domElement.toDataURL(
      `image_${images.current.length}/png`
    );

    const idx = dataURL.indexOf("base64,") + "base64,".length;
    const content = dataURL.substring(idx);

    images.current.push({
      name: "image" + images.current.length + ".png",
      dataURL: content,
    });
  }, [images, gl]);

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

    images.current = [];
    console.log("Taking screenshots...");

    intervalRef.current = scheduleInterval(
      captureScreenshotData,
      intervals,
      iterations,
      async () => {
        console.log("Stopped taking screenshots.");

        if (exportFormat === "zip") {
          await downloadImageFiles();
        } else {
          const dataUrl = await createSpritesheet(
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
  ]);

  useEffect(() => {
    PubSub.on(EventType.START_ASSETS_CREATION, takeScreenshot);

    // Clean up the subscription when the component unmounts
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, takeScreenshot);
    };
  }, [takeScreenshot]);

  const { height, width } = useControls({
    frame: folder({
      height: 150,
      width: 300,
    }),
  });

  return (
    <div className="flex flex-1 w-full h-full flex-col items-center justify-center">
      <div
        style={{
          border: "1px solid var(--color-border)",
          height,
          width,
        }}
      >
        <Canvas
          gl={{
            preserveDrawingBuffer: true,
          }}
          onCreated={({ gl }) => setGl(gl)}
          ref={canvas}
        >
          <ambientLight intensity={Math.PI / 2} />
          <spotLight
            position={[10, 10, 10]}
            angle={0.15}
            penumbra={1}
            decay={0}
            intensity={Math.PI}
          />
          <pointLight
            position={[-10, -10, -10]}
            decay={0}
            intensity={Math.PI}
          />
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
            {!modelFile && <Box />}
            {modelFile && (
              <FileModel
                rotation={rotation}
                position={position}
                scale={scale}
                file={modelFile}
              />
            )}
          </Selection>
          <OrbitControls enableZoom={false} />
        </Canvas>
      </div>
    </div>
  );
}

export default AssetCreation;
