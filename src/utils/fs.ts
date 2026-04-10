type FileSystemDirectory = "models" | "general";

const getDir = async (
  dir: FileSystemDirectory,
  create = true,
): Promise<FileSystemDirectoryHandle> => {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(dir, { create });
};

export const saveFileToOPFS = async (
  uuid: string,
  file: File,
  folder: FileSystemDirectory = "general",
): Promise<string> => {
  const dir = await getDir(folder);

  const fileName = `${uuid}.${file.name.split(".").pop()}`;

  const handleDir = await dir.getFileHandle(fileName, { create: true });
  const writable = await handleDir.createWritable();
  await writable.write(file);
  await writable.close();

  return fileName;
};

export const readFileFromOPFS = async (
  fileName: string,
  folder: FileSystemDirectory = "general",
): Promise<File> => {
  const dir = await getDir(folder, false);
  const handle = await dir.getFileHandle(fileName);
  return handle.getFile();
};

export const deleteFileFromOPFS = async (
  fileName: string,
  folder: FileSystemDirectory = "general",
): Promise<void> => {
  const dir = await getDir(folder);
  await dir.removeEntry(fileName).catch(() => {}); // ignore if already gone
};

export async function getFileFromOPFS(
  uuid: string,
  folder: FileSystemDirectory = "general",
): Promise<ArrayBuffer | null> {
  try {
    const dir = await getDir(folder, false);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Type is broken
    const entries = dir.values();
    for await (const entry of entries) {
      if (entry.kind === "file" && entry.name.startsWith(uuid)) {
        const file = await (entry as FileSystemFileHandle).getFile();
        return await file.arrayBuffer();
      }
    }
    return null;
  } catch {
    return null;
  }
}

export const downloadFile = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};
