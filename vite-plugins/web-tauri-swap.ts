import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

export function WebTauriSwapPlugin(): Plugin {
  const __TAURI__ = !!process.env.TAURI_BUILD;
  const __CLI__ = !!process.env.CLI_BUILD;

  return {
    name: "vite-plugin-web-tauri-swap",
    enforce: "pre",
    resolveId(source, importer) {
      if (!__TAURI__ && !__CLI__) return null;

      // match .web.ts, .web.tsx, or extensionless .web
      const match = source.match(/(.+\.web)(\.ts|\.tsx)?$/);
      if (match) {
        const [, base] = match;
        const extensions = [".ts", ".tsx"];

        // Determine which variants to look for (tauri first, then cli)
        const variants = [];
        if (__TAURI__) variants.push(".tauri");
        if (__CLI__) variants.push(".cli");

        for (const variant of variants) {
          for (const ext of extensions) {
            const variantFile = path.resolve(
              path.dirname(importer!),
              base.replace(/\.web$/, variant) + ext,
            );
            if (fs.existsSync(variantFile)) {
              return variantFile;
            }
          }
        }
      }

      return null;
    },
  };
}
