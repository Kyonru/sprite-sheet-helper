import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

export function WebTauriSwapPlugin(): Plugin {
  const __TAURI__ = !!process.env.TAURI_BUILD;

  return {
    name: "vite-plugin-web-tauri-swap",
    enforce: "pre",
    resolveId(source, importer) {
      if (!__TAURI__) return null;

      // match .web.ts, .web.tsx, or extensionless .web
      const match = source.match(/(.+\.web)(\.ts|\.tsx)?$/);
      if (match) {
        const [, base] = match;
        const extensions = [".ts", ".tsx"];
        for (const ext of extensions) {
          const tauriFile = path.resolve(
            path.dirname(importer!),
            base.replace(/\.web$/, ".tauri") + ext,
          );
          if (fs.existsSync(tauriFile)) {
            return tauriFile;
          }
        }
      }

      return null;
    },
  };
}
