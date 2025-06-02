import "./App.css";
import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import TimelineEditor from "./components/timeline";
import { useFrameValues } from "./hooks/use-frame-values";
import { AssetScene } from "./components/scene";

function AssetCreation() {
  const canvas = useRef<HTMLCanvasElement>(null);

  const { previewHeight, previewWidth } = useFrameValues();

  return (
    <div className="flex flex-1 w-full h-full flex-col">
      <div className="flex flex-1 w-full h-full flex-col items-center justify-center">
        <div
          className="border-1 border-chart-3/25"
          style={{
            height: previewHeight,
            width: previewWidth,
          }}
        >
          <Canvas
            gl={{
              preserveDrawingBuffer: true,
            }}
            ref={canvas}
          >
            <AssetScene />
          </Canvas>
        </div>
      </div>
      <TimelineEditor />
    </div>
  );
}

export default AssetCreation;
