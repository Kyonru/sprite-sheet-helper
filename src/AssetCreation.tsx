import "./App.css";
import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import TimelineEditor from "./components/timeline";
import { useFrameValues } from "./hooks/use-frame-values";
import { AssetScene } from "./components/scene";
import { LevaPanel } from "leva";
import { useSharedContext } from "./context/sharedContext";
import { LEVA_THEME } from "./constants/theming";

const ENABLE_TIMELINE = false;

function AssetCreation() {
  const canvas = useRef<HTMLCanvasElement>(null);

  const { previewHeight, previewWidth } = useFrameValues();
  const { levaStore } = useSharedContext();

  return (
    <div className="flex flex-1 w-full h-full flex-col">
      <div className="relative">
        <div
          style={{
            position: "absolute",
            zIndex: 999,
            top: "4vh",
            right: "4vw",
          }}
        >
          <LevaPanel
            theme={LEVA_THEME}
            fill
            titleBar={{ title: "Export Options" }}
            store={levaStore}
          />
        </div>
      </div>
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
      {ENABLE_TIMELINE && <TimelineEditor />}
    </div>
  );
}

export default AssetCreation;
