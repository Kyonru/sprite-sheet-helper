/**
 * Runner for the pose capture benchmark.
 *
 * The benchmark deliberately imports the app's real modules
 * (`src/utils/pose-solve.ts` and friends) rather than re-implementing the
 * solve. Those modules use extensionless relative imports and the `@/` alias,
 * which Vite resolves and bare Node ESM does not — so the benchmark is loaded
 * through Vite's SSR module loader, exactly the resolution the app itself
 * gets. No extra dependency: `vite` is already here.
 *
 *   npm run pose:bench -- --landmarks <json> --character <glb> [--fps 24]
 */

import { createServer } from "vite";

/**
 * Minimal FileReader for three's GLTFExporter, which uses it to turn a Blob
 * into an ArrayBuffer. Node has Blob but not FileReader, and the exporter only
 * ever calls readAsArrayBuffer + onloadend, so this is the whole surface it
 * needs. Confined to this runner: nothing shipped in the app relies on it.
 */
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    constructor() {
      this.result = null;
      this.onloadend = null;
      this.onerror = null;
    }
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          this.onloadend?.({ target: this });
        })
        .catch((error) => this.onerror?.(error));
    }
  };
}

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
  // Skip dependency pre-bundling entirely. It is only useful for a browser
  // session, and its scanner crawls index.html -> src/App.tsx, which imports
  // `.web`/`.tauri` variants that need the repo's swap plugin. This runner
  // loads one module through the SSR pipeline and needs none of that.
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: {
    alias: { "@": new URL("../src", import.meta.url).pathname },
  },
});

try {
  const mod = await server.ssrLoadModule("/scripts/pose-bench.ts");
  process.exitCode = await mod.main();
} catch (error) {
  console.error(`\nFAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await server.close();
}
