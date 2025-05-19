import { ThemeProvider } from "@/components/theme-provider";

import AssetCreation from "./AssetCreation";
import Layout from "./layout";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Layout>
        <AssetCreation />
      </Layout>
    </ThemeProvider>
  );
}

export default App;
