import type { Exporter } from "@/types/file";
import { buildSpritesheetAssets, createNormalMapFile } from "./helpers";

export const SpritesheetExporter: Exporter<"spritesheet"> = {
  id: "spritesheet",
  label: "Spritesheet",

  async run({ exportedImages, includeNormalMap }) {
    const { json, base64PNG, normalBase64PNG } =
      await buildSpritesheetAssets(exportedImages, { includeNormalMap });

    return {
      filename: "spritesheet.zip",
      files: [
        { name: "spritesheet.png", content: base64PNG, base64: true },
        ...createNormalMapFile(normalBase64PNG),
        { name: "spritesheet.json", content: JSON.stringify(json, null, 2) },
      ],
    };
  },
};
