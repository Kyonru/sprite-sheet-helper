import type { Exporter } from "@/types/file";
import { buildSpritesheetAssets } from "./helpers";

export const SpritesheetExporter: Exporter<"spritesheet"> = {
  id: "spritesheet",
  label: "Spritesheet",

  async run({ exportedImages }) {
    const { json, base64PNG } = await buildSpritesheetAssets(exportedImages);

    return {
      filename: "spritesheet.zip",
      files: [
        { name: "spritesheet.png", content: base64PNG, base64: true },
        { name: "spritesheet.json", content: JSON.stringify(json, null, 2) },
      ],
    };
  },
};
