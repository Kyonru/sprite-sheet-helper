import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import * as THREE from "three";
import React, { useRef, useState } from "react";
import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber";
import JSZip from "jszip";

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

    intervalRef.current = setInterval(captureScreenshotData, interval);

    setTimeout(() => {
      if (!intervalRef.current) return;
      clearInterval(intervalRef.current);
      console.log("Stopped taking screenshots.");
      downloadImageFiles();
    }, interval * iterations);
  };

  return (
    <div>
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
        <Box position={[-3, 0, 0]} />
        <Box position={[3, 0, 0]} />
      </Canvas>
    </div>
  );

  // const [count, setCount] = useState(0)

  // return (
  //   <>
  //     <div>
  //       <a href="https://vite.dev" target="_blank">
  //         <img src={viteLogo} className="logo" alt="Vite logo" />
  //       </a>
  //       <a href="https://react.dev" target="_blank">
  //         <img src={reactLogo} className="logo react" alt="React logo" />
  //       </a>
  //     </div>
  //     <h1>Vite + React</h1>
  //     <div className="card">
  //       <button onClick={() => setCount((count) => count + 1)}>
  //         count is {count}
  //       </button>
  //       <p>
  //         Edit <code>src/App.tsx</code> and save to test HMR
  //       </p>
  //     </div>
  //     <p className="read-the-docs">
  //       Click on the Vite and React logos to learn more
  //     </p>
  //   </>
  // )
}

export default App;
