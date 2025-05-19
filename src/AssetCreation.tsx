import "./App.css";
import * as THREE from "three";
import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber";
import JSZip from "jszip";
import { scheduleInterval } from "./utils/time";
import { FileModel } from "./components/file-model";
import {
  GlitchMode,
  BlendFunction,
  Resizer,
  KernelSize,
  Resolution,
} from "postprocessing";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  Glitch,
  Noise,
  Outline,
  Pixelation,
  Vignette,
} from "@react-three/postprocessing";
import { Button } from "@/components/ui/button";
import { EventType, PubSub } from "./lib/events";
import { useModelStore } from "./store/model";
import { useExportOptionsStore } from "./store/export";
import { PostProcessingEffects } from "./components/effects";

type ExportFormat = "zip" | "spritesheet";

async function createSpritesheet(images: string[]): Promise<string> {
  const loadedImages = await Promise.all(
    images.map((src) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = "data:image/png;base64," + src;
      });
    })
  );

  const width = Math.max(...loadedImages.map((img) => img.width));
  const height = loadedImages.reduce((sum, img) => sum + img.height, 0);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  let y = 0;
  for (const img of loadedImages) {
    ctx.drawImage(img, 0, y);
    y += img.height;
  }

  return canvas.toDataURL("image/png");
}

function Box(props: ThreeElements["mesh"]) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);

  useFrame((_, delta) => (meshRef.current.rotation.x += delta));
  return (
    <mesh
      {...props}
      ref={meshRef}
      scale={active ? 3 : 1.5}
      onClick={() => setActive(!active)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? "hotpink" : "#2f74c0"} />
    </mesh>
  );
}

const downloadFile = (href: string, name: string) => {
  const a = document.createElement("a");
  a.target = "_blank";
  a.href = href;
  a.download = name;
  a.click();
};

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

  const box1Ref = useRef<THREE.Mesh>(null!);

  return (
    <div>
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
        <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
        <Box ref={box1Ref} position={[-3, 0, 0]} />
        <Box position={[3, 0, 0]} />
        {modelFile && (
          <FileModel
            rotation={rotation}
            position={position}
            scale={scale}
            file={modelFile}
          />
        )}

        <PostProcessingEffects />
      </Canvas>
    </div>
  );
}

export default AssetCreation;
