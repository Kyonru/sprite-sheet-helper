import type { Exporter } from "@/types/file";

export const zipExporter: Exporter<"zip"> = {
  id: "zip",
  label: "Images (ZIP)",

  async run({ exportedImages }) {
    const files = [];

    for (const row of exportedImages) {
      for (let j = 0; j < row.images.length; j++) {
        files.push({
          name: `${row.label}/${row.uuid}_${j}.png`,
          content: row.images[j],
          base64: true,
        });
      }
    }

    return {
      filename: "images.zip",
      files,
    };
  },
};
