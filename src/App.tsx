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

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SharedContextProvider>
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
      </SharedContextProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}

export default App;
