import { useEffect } from "react";
import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import { useProjectStore } from "@/store/next/project";
import { readFile } from "@tauri-apps/plugin-fs";

const parseFilePath = (raw: string): string | null => {
  if (raw.startsWith("file://")) {
    return decodeURIComponent(raw.slice(7));
  }
  return raw.endsWith(".sshProj") ? raw : null;
};

const loadFromPath = async (
  path: string,
  load: (file: File) => void,
): Promise<void> => {
  const data = await readFile(path);
  const fileName = path.split(/[\\/]/).pop()!;

  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  );

  load(new File([buffer], fileName));
};

export default function useFileHandlers() {
  const load = useProjectStore((state) => state.load);

  useEffect(() => {
    //  App was launched by opening a file (deep-link holds the initial URL)
    getCurrent().then((urls) => {
      console.log("🚀 App was launched by opening a file:", urls);

      if (!urls) return;
      for (const url of urls) {
        const path = parseFilePath(url);
        if (path) {
          loadFromPath(path, load);
          break;
        }
      }
    });

    //  File opened while the app is already running
    const unlistenPromise = onOpenUrl((urls) => {
      console.log("🚀 File opened while the app is already running:", urls);

      for (const url of urls) {
        const path = parseFilePath(url);
        if (path) {
          loadFromPath(path, load);
          break;
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
