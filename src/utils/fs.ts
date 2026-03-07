type FileSystemDirectory = "models" | "general";

const getDir = async (
  dir: FileSystemDirectory,
): Promise<FileSystemDirectoryHandle> => {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(dir, { create: true });
};

export const saveFileToOPFS = async (
  uuid: string,
  file: File,
  folder: FileSystemDirectory = "general",
): Promise<string> => {
  const dir = await getDir(folder);

  console.log({ dir });
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
  const dir = await getDir(folder);
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
