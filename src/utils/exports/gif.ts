import type { Exporter, ExportFile } from "@/types/file";
import { createGif } from "../assets";

export const gifExporter: Exporter<"gif"> = {
  id: "gif",
  label: "GIF (ZIP)",

  async run({ exportedImages, frameDelay }) {
    const files: ExportFile[] = await Promise.all(
      exportedImages.map(async (row) => {
        const gifUrl = await createGif(
          row.images,
          row.frameWidth,
          row.frameHeight,
          frameDelay,
        );

        const raw = await fetch(gifUrl);
        const content = await raw.arrayBuffer();
        URL.revokeObjectURL(gifUrl);

        return {
          name: `${row.label}.gif`,
          content,
        };
      }),
    );

    return {
      filename: "gif.zip",
      files,
    };
  },
};
