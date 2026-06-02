import type { Exporter } from "@/types/file";
import { buildSpritesheetAssets } from "./helpers";

export const SpritesheetExporter: Exporter<"spritesheet"> = {
  id: "spritesheet",
  label: "Spritesheet",

  async run({ exportedImages, includeNormalMap, atlasOptions }) {
    const { json, colorPages, normalPages } = await buildSpritesheetAssets(
      exportedImages,
      { includeNormalMap, atlasOptions },
    );

    return {
      filename: "spritesheet.zip",
      files: [
        ...colorPages,
        ...normalPages,
        { name: "spritesheet.json", content: JSON.stringify(json, null, 2) },
      ],
    };
  },
};
