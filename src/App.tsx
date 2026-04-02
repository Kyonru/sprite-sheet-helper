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

THREE.Cache.enabled = true;

function App() {
  const mainPanelStore = useCreateStore();

  const addCamera = useAddCamera(true);
  const addLight = useAddLight(false);
  const init = useRef(false);

  useEffect(() => {
    setTimeout(() => {
      if (init.current) return;
      init.current = true;
      addCamera({
        position: [0, 5, 5],
      });
      addLight("ambient");
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <ResizablePanel defaultSize="25%">
                <MainPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <SharedSceneProvider>
                <AssetCreation />
              </SharedSceneProvider>
            </ResizablePanelGroup>
          </Layout>
          <ExportModal />
        </MainPanelContextProvider>
      </SharedContextProvider>
      <ConfirmProvider />
      <ReorderModalProvider />
      <SettingsModalProvider />
      <DocsModalProvider />
      <AboutModalProvider />
      <ShaderEditorProvider />
      <Toaster richColors />
    </ThemeProvider>
  );
}

export default App;
