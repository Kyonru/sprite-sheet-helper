import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type UserConfig } from "vite";
import { WebTauriSwapPlugin } from "./vite-plugins/web-tauri-swap";

const host = process.env.TAURI_DEV_HOST;

const __TAURI__ = !!process.env.TAURI_BUILD;

const tauriConfig: Partial<UserConfig> = {
  clearScreen: false,
  server: {
    port: 4173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Env variables starting with the item of `envPrefix` will be exposed in tauri's source code through `import.meta.env`.
  envPrefix: ["VITE_", "TAURI_ENV_*"],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target:
      process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    __TAURI__ && WebTauriSwapPlugin(),
    react(),
    tailwindcss(),
    !__TAURI__ &&
      VitePWA({
        injectRegister: "auto",
        workbox: {
          sourcemap: true,
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  ...(__TAURI__ ? tauriConfig : {}),
});
