import {
  BaseDirectory,
  writeFile,
  readFile as readFileFS,
  remove,
  readDir,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";

type FileSystemDirectory = "models" | "general";

const ensureDir = async (dir: FileSystemDirectory) => {
  const dirExists = await exists(dir, {
    baseDir: BaseDirectory.AppData,
  });

  if (!dirExists) {
    await mkdir(dir, {
      baseDir: BaseDirectory.AppData,
      recursive: true,
    });
  }

  return dir;
};

const uint8ToFile = (
  data: Uint8Array,
  fileName: string,
  mimeType?: string,
): File => {
  // Force ArrayBuffer (fix TS + avoids subtle bugs)
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  );

  return new File([buffer as ArrayBuffer], fileName, {
    type: mimeType ?? getMimeType(fileName),
  });
};

const getMimeType = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "glb":
      return "model/gltf-binary";
    case "gltf":
      return "model/gltf+json";
    case "json":
      return "application/json";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
};

export const saveFileToFS = async (
  uuid: string,
  file: File,
  folder: FileSystemDirectory = "general",
): Promise<string> => {
  const dir = await ensureDir(folder);

  const ext = file.name.split(".").pop();
  const fileName = `${uuid}.${ext}`;
  const path = `${dir}/${fileName}`;

  const buffer = new Uint8Array(await file.arrayBuffer());

  await writeFile(path, buffer, {
    baseDir: BaseDirectory.AppData,
  });

  return fileName;
};

export const readFileFromFS = async (
  fileName: string,
  folder: FileSystemDirectory = "general",
): Promise<File> => {
  const path = `${folder}/${fileName}`;

  const data = await readFileFS(path, {
    baseDir: BaseDirectory.AppData,
  });

  return uint8ToFile(data, fileName);
};

export const deleteFileFromFS = async (
  fileName: string,
  folder: FileSystemDirectory = "general",
): Promise<void> => {
  const path = `${folder}/${fileName}`;

  try {
    await remove(path, {
      baseDir: BaseDirectory.AppData,
    });
  } catch {
    // ignore if already deleted
  }
};

export const getFileFromFS = async (
  uuid: string,
  folder: FileSystemDirectory = "general",
): Promise<File | null> => {
  try {
    const entries = await readDir(folder, {
      baseDir: BaseDirectory.AppData,
    });

    for (const entry of entries) {
      if (entry.name?.startsWith(uuid)) {
        const path = `${folder}/${entry.name}`;

        const data = await readFileFS(path, {
          baseDir: BaseDirectory.AppData,
        });

        return uint8ToFile(data, entry.name);
      }
    }

    return null;
  } catch {
    return null;
  }
};

export const readFile = (
  file: File,
  asText = false,
): Promise<ArrayBuffer | string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result;
      if (result == null) reject(new Error("Failed to read file"));
      else resolve(result as ArrayBuffer | string);
    };

    reader.onerror = () => reject(reader.error);

    if (asText) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
