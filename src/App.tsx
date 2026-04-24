import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import AssetCreation from "./components/panels/scene";
import Layout from "./layout";
import { SharedContextProvider } from "./context/sharedContext";
import MainPanel from "./components/panels/main";

import { ExportModal } from "./components/export-modal";
import { MainPanelContextProvider } from "./components/panels/main/context";
import { useCreateStore } from "leva";
import { useAddCamera } from "./hooks/next/use-add-camera";
import { useAddLight } from "./hooks/next/use-add-light";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SharedSceneProvider } from "./context/shared-scene";
import { ConfirmProvider } from "./components/confirm";
import { ReorderModalProvider } from "./components/animation-reorder-modal";
import { SettingsModalProvider } from "./components/panels/top/settings";
import { useSettingsStore } from "./store/next/settings";
import { DocsModalProvider } from "./components/docs";
import { AboutModalProvider } from "./components/about-modal";
import { ShaderEditorProvider } from "./components/custom-shader-modal";
import { CameraAnimationCaptureProvider } from "./components/camera-animation-capture";
import { initShortcutRegistry } from "./lib/shortcut-registry";
import { useKeyboardShortcuts } from "./hooks/next/use-keyboard-shortcuts";
import { EventType, PubSub } from "./lib/events";
import useFileHandlers from "./hooks/file/use-file-handlers.web";

THREE.Cache.enabled = true;
initShortcutRegistry();

function App() {
  const mainPanelStore = useCreateStore();

  const addCamera = useAddCamera(true);
  const addLight = useAddLight(false);
  const init = useRef(false);

  useEffect(() => {
    const initProject = () => {
      if (init.current) return;
      init.current = true;
      addCamera({
        position: [0, 2.5, 3],
      });
      addLight("ambient", "Ambient Light", {
        intensity: 1,
      });
    };

    const restartProject = () => {
      init.current = false;
      initProject();
    };

    PubSub.on(EventType.NEW_PROJECT, restartProject);

    setTimeout(() => {
      initProject();
    }, 0);

    return () => {
      PubSub.off(EventType.NEW_PROJECT, restartProject);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useKeyboardShortcuts();
  useFileHandlers();

  const theme = useSettingsStore((state) => state.theme);

  return (
    <ThemeProvider defaultTheme={theme} storageKey="vite-ui-theme">
      <SharedContextProvider>
        <MainPanelContextProvider defaultStore={mainPanelStore}>
          <Layout>
            <ResizablePanelGroup
              orientation="horizontal"
              className="max-w-full border"
            >
              <ResizablePanel defaultSize="20%">
                <MainPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <SharedSceneProvider>
                <AssetCreation />
              </SharedSceneProvider>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="20%">
                <ExportModal />
              </ResizablePanel>
            </ResizablePanelGroup>
          </Layout>
        </MainPanelContextProvider>
      </SharedContextProvider>
      <ConfirmProvider />
      <ReorderModalProvider />
      <SettingsModalProvider />
      <DocsModalProvider />
      <AboutModalProvider />
      <ShaderEditorProvider />
      <CameraAnimationCaptureProvider />
      <Toaster richColors />
    </ThemeProvider>
  );
}

export default App;
