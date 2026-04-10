import { downloadFile } from "@/utils/assets";
import { toast } from "sonner";

export default async function saveAs(
  blob: Blob,
  name: string,
  types: string[],
  description: string,
) {
  if ("showSaveFilePicker" in window) {
    try {
      // @ts-expect-error - showSaveFilePicker is not yet in TypeScript's lib.dom.d.ts
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: description,
            accept: { "application/octet-stream": types },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (e) {
      // User cancelled the picker — not an error
      if ((e as Error).name === "AbortError") return;
      toast.error(`Failed to save project: ${(e as Error).message}`);
      return;
    }
  } else {
    // Fallback for browsers without File System Access API
    downloadFile(blob, name);
  }
}
