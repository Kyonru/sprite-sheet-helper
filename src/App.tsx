import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import AssetCreation from "./AssetCreation";
import Layout from "./layout";
import { SharedContextProvider } from "./context/sharedContext";
import MainPanel from "./components/panels/main";

import { ExportModal } from "./components/export-modal";
import { MainPanelContextProvider } from "./components/panels/main/context";
import { useCreateStore } from "leva";
import { useAddCamera } from "./hooks/next/use-add-camera";
import { useAddLight } from "./hooks/next/use-add-light";
import { useEffect, useRef } from "react";

function App() {
  const mainPanelStore = useCreateStore();

  const addCamera = useAddCamera();
  const addLight = useAddLight(false);
  const init = useRef(false);

  useEffect(() => {
    setTimeout(() => {
      if (init.current) return;
      init.current = true;
      addCamera();
      addLight("ambient");
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SharedContextProvider>
        <MainPanelContextProvider store={mainPanelStore}>
          <Layout>
            <ResizablePanelGroup
              orientation="horizontal"
              className="max-w-full border"
            >
              <ResizablePanel defaultSize="25%">
                <MainPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <AssetCreation />
            </ResizablePanelGroup>
          </Layout>
          <ExportModal />
        </MainPanelContextProvider>
      </SharedContextProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}

export default App;
