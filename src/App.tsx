import { ThemeProvider } from "@/components/theme-provider";

import AssetCreation from "./AssetCreation";
import Layout from "./layout";
import { SharedContextProvider } from "./context/sharedContext";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SharedContextProvider>
        <Layout>
          <AssetCreation />
        </Layout>
      </SharedContextProvider>
    </ThemeProvider>
  );
}

export default App;
