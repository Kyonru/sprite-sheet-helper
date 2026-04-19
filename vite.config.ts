import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type UserConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { WebTauriSwapPlugin } from "./vite-plugins/web-tauri-swap";

const host = process.env.TAURI_DEV_HOST;

const __TAURI__ = !!process.env.TAURI_BUILD;
const __CLI__ = !!process.env.CLI_BUILD;
const __WEB__ = !__TAURI__ && !__CLI__;

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
  define: {
    __CLI_BUILD__: JSON.stringify(__CLI__),
  },
  plugins: [
    (__TAURI__ || __CLI__) && WebTauriSwapPlugin(),
    react(),
    tailwindcss(),
    __WEB__ &&
      VitePWA({
        injectRegister: "auto",
        workbox: {
          sourcemap: true,
          maximumFileSizeToCacheInBytes: 3.5 * 1024 * 1024,
        },
      }),
    devtools({
      removeDevtoolsOnBuild: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: __CLI__
    ? {
        // CLI builds run on Node.js, not browsers
        target: "es2022",
        // Don't delete dist/cli that was compiled by TypeScript
        emptyOutDir: false,
      }
    : undefined,

  ...(__TAURI__ ? tauriConfig : {}),
});
