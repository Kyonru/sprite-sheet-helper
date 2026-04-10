import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export default async function saveAs(
  blob: Blob,
  name: string,
  types: string[],
  description: string,
) {
  try {
    const cleanTypes = types.map((t) => t.replace(/^\./, ""));

    let path = await save({
      defaultPath: name,
      filters: [
        {
          name: description,
          extensions: cleanTypes,
        },
      ],
    });

    if (!path) return;

    const hasValidExt = cleanTypes.some((ext) =>
      path!.toLowerCase().endsWith(`.${ext.toLowerCase()}`),
    );

    if (!hasValidExt) {
      path += `.${cleanTypes[0]}`;
    }

    const buffer = new Uint8Array(await blob.arrayBuffer());

    await writeFile(path, buffer);
  } catch (e) {
    toast.error(`Failed to save project: ${(e as Error).message}`);
  }
}
