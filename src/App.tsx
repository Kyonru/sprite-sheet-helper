import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

import AssetCreation from "./AssetCreation";
import Layout from "./layout";
import { SharedContextProvider } from "./context/sharedContext";
import ReloadPrompt from "./components/reload-prompt";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SharedContextProvider>
        <Layout>
          <AssetCreation />
        </Layout>
      </SharedContextProvider>
      <Toaster richColors />
      <ReloadPrompt />
    </ThemeProvider>
  );
}

export default App;
