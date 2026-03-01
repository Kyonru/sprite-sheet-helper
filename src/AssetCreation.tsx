import "./App.css";
import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import TimelineEditor from "./components/timeline";
import { useFrameValues } from "./hooks/use-frame-values";
import { AssetScene, WithoutCamera } from "./components/scene";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useExportOptionsStore } from "./store/export";
import { Editor } from "./components/editor";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { OrbitControls } from "@react-three/drei";
import { Camera } from "./components/camera";

const ENABLE_TIMELINE = false;
const ENABLE_CODE_EDITOR = false;

function AssetCreation() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const canvas2 = useRef<HTMLCanvasElement>(null);

  const { previewHeight, previewWidth } = useFrameValues();
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
    <ResizablePanel defaultSize="75%">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize="60%">
          <div className="flex flex-1 w-full h-full flex-col items-center justify-center">
            <Canvas
              gl={{
                preserveDrawingBuffer: true,
              }}
              ref={canvas2}
            >
              <OrbitControls />
              <WithoutCamera
                camera={<perspectiveCamera position={[0, 0, 5]} />}
              />
              <Camera isDefault={false} useOrbitControls={false} />
            </Canvas>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="40%">
          <div className="flex items-center justify-center p-6">
            <div className="flex flex-col">
              <div className="flex flex-col items-center justify-center">
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
              {ENABLE_CODE_EDITOR && (
                <Sheet>
                  <SheetTrigger>Open</SheetTrigger>
                  <SheetContent side="bottom" className="z-[999] h-[90vh]">
                    <SheetHeader>
                      <SheetTitle>Are you absolutely sure?</SheetTitle>
                      <SheetDescription>
                        This action cannot be undone.
                      </SheetDescription>
                    </SheetHeader>

                    <Editor />
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ResizablePanel>
  );
}

export default AssetCreation;
