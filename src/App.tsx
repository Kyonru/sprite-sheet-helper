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
import TopPanel from "./components/panels/top";

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
            <ResizablePanel defaultSize="75%">
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize="75%">
                  <div className="flex h-full items-center justify-center p-6">
                    <AssetCreation />
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="25%">
                  <div className="flex h-full items-center justify-center p-6">
                    <span className="font-semibold">Three</span>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </Layout>
      </SharedContextProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}

export default App;
