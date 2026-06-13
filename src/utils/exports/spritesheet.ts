import type { Exporter } from "@/types/file";
import { buildSpritesheetAssets } from "./helpers";

export const SpritesheetExporter: Exporter<"spritesheet"> = {
  id: "spritesheet",
  label: "Spritesheet",

  async run({ exportedImages, includeNormalMap, atlasOptions, spritePostprocess }) {
    const { json, manifestFile, colorPages, normalPages } =
      await buildSpritesheetAssets(exportedImages, {
        includeNormalMap,
        atlasOptions,
        exporterId: "spritesheet",
      spritePostprocess,
      });

    return {
      filename: "spritesheet.zip",
      files: [
        ...colorPages,
        ...normalPages,
        { name: "spritesheet.json", content: JSON.stringify(json, null, 2) },
        manifestFile,
      ],
    };
  },
};
