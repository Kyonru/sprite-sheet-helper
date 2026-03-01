import "./App.css";
import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { useExportOptionsStore } from "./store/export";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { OrbitControls, View } from "@react-three/drei";

function SharedScene() {
  return (
    <>
      <ambientLight />
      <mesh>
        <boxGeometry />
        <meshStandardMaterial color="hotpink" />
      </mesh>
    </>
  );
}

function AssetCreation() {
  const ref1 = useRef<HTMLDivElement>(null!);
  const ref2 = useRef<HTMLDivElement>(null!);

  const exportedImages = useExportOptionsStore((state) => state.images);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (exportedImages.length === 0) return;
      e.preventDefault();
      // Deprecated, but still required for most browsers to trigger the confirmation
      e.returnValue = true;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [exportedImages]);

  return (
    <>
      {/* Two DOM elements act as the "windows" */}

      <Canvas
        eventSource={document.getElementById("root") as HTMLElement}
        style={{ position: "fixed", top: 0 }}
      >
        {/* Shared scene objects */}
        <View track={ref1}>
          <perspectiveCamera position={[0, 0, 5]} />
          <OrbitControls />
          <SharedScene />
        </View>

        <View track={ref2}>
          <orthographicCamera position={[5, 5, 5]} zoom={50} />
          <OrbitControls />
          <SharedScene />
        </View>
      </Canvas>

      <ResizablePanel defaultSize="75%">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel
            defaultSize="60%"
            className="overflow-hidden overflow-y-scroll"
          >
            <div ref={ref1} style={{ width: 400, height: 400 }} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            defaultSize="40%"
            className="overflow-hidden overflow-y-scroll"
          >
            <div ref={ref2} style={{ width: 400, height: 400 }} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </>
  );
}

export default AssetCreation;
