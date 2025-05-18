import "./App.css";
import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
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

type ExportFormat = "zip" | "spritesheet";

const defaultFragmentShader = `
`;

const defaultVertexShader = `
`;

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

  useFrame((state, delta) => (meshRef.current.rotation.x += delta));
  return (
    <mesh
      {...props}
      ref={meshRef}
      scale={active ? 3 : 1.5}
      onClick={(event) => setActive(!active)}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}
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

function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [gl, setGl] = useState<THREE.WebGLRenderer>();
  const interval = 250;
  const iterations = 10;
  const images = useRef<
    {
      name: string;
      dataURL: string;
    }[]
  >([]);
  const intervalRef = useRef<number>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("zip");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [fragmentShader, setFragmentShader] = useState(defaultFragmentShader);
  const [vertexShader, setVertexShader] = useState(defaultVertexShader);
  const renderTarget = useRef<THREE.WebGLRenderTarget | null>(
    new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight)
  );

  useEffect(() => {
    if (gl) {
      renderTarget.current = new THREE.WebGLRenderTarget(
        gl.domElement.width,
        gl.domElement.height
      );
    }
  }, [gl]);

  const captureScreenshotData = () => {
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
  };

  const downloadImageFiles = async () => {
    const zip = new JSZip();

    for (let i = 0; i < images.current.length; i++) {
      zip.file(images.current[i].name, images.current[i].dataURL, {
        base64: true,
      });
    }

    const zipData = await zip.generateAsync({ type: "base64" });

    downloadFile("data:application/zip;base64," + zipData, "images.zip");
  };

  const takeScreenshot = () => {
    if (!gl) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    images.current = [];
    console.log("Taking screenshots...");

    intervalRef.current = scheduleInterval(
      captureScreenshotData,
      interval,
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
  };

  const box1Ref = useRef<THREE.Mesh>(null!);

  return (
    <div>
      <input
        type="file"
        accept=".glb,.gltf,.obj,.fbx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setModelFile(file);
        }}
      />
      <div>
        <label>Export format: </label>
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
        >
          <option value="zip">ZIP</option>
          <option value="spritesheet">Spritesheet</option>
        </select>
      </div>
      <button onClick={takeScreenshot}>Take Screenshots</button>
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
          <FileModel position={[0, 0, 0]} scale={0.05} file={modelFile} />
        )}

        <EffectComposer>
          {/* <DepthOfField
            focusDistance={0}
            focalLength={0.02}
            bokehScale={2}
            height={480}
          />
          <Bloom luminanceThreshold={0} luminanceSmoothing={0.9} height={300} />
          <Noise opacity={0.02} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
          <Glitch
            delay={[1.5, 3.5]} // min and max glitch delay
            duration={[0.6, 1.0]} // min and max glitch duration
            strength={[0.3, 1.0]} // min and max glitch strength
            mode={GlitchMode.SPORADIC} // glitch mode
            active // turn on/off the effect (switches between "mode" prop and GlitchMode.DISABLED)
            ratio={0.85} // Threshold for strong glitches, 0 - no weak glitches, 1 - no strong glitches.
          /> */}
          {/* <Pixelation
            granularity={5} // pixel granularity
          /> */}

          {box1Ref.current && (
            <Outline
              selection={[box1Ref.current]} // selection of objects that will be outlined
              selectionLayer={10} // selection layer
              blendFunction={BlendFunction.SCREEN} // set this to BlendFunction.ALPHA for dark outlines
              patternTexture={null} // a pattern texture
              edgeStrength={2.5} // the edge strength
              pulseSpeed={0.0} // a pulse speed. A value of zero disables the pulse effect
              visibleEdgeColor={0xffffff} // the color of visible edges
              hiddenEdgeColor={0x22090a} // the color of hidden edges
              width={Resolution.AUTO_SIZE} // render width
              height={Resolution.AUTO_SIZE} // render height
              kernelSize={KernelSize.LARGE} // blur kernel size
              blur={false} // whether the outline should be blurred
              xRay={true} // indicates whether X-Ray outlines are enabled
            />
          )}
        </EffectComposer>
      </Canvas>
    </div>
  );
}

export default App;
