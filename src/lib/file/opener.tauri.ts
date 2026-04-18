import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

export default async function openFile(
  accepts: string[],
  onFile: (file: File) => void,
) {
  try {
    const filePath = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Import",
          extensions: accepts,
        },
      ],
    });

    if (!filePath || typeof filePath !== "string") return;

    const data = await readFile(filePath);

    const fileName = filePath.split("/").pop()!;

    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    );

    const file = new File([buffer], fileName);

    onFile(file);
  } catch (e) {
    toast.error(`File could not be opened. ${e}`);
  }
}
