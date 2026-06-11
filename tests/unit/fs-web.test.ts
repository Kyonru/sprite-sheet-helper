import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastWarning = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    warning: (...args: unknown[]) => toastWarning(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

type FakeStoredFile = {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function makeFakeStorage() {
  const dirs = new Map<string, Map<string, FakeStoredFile>>();

  const makeDirHandle = (files: Map<string, FakeStoredFile>) => ({
    getFileHandle: async (fileName: string, opts?: { create?: boolean }) => {
      if (!files.has(fileName) && !opts?.create) {
        throw new DOMException("not found", "NotFoundError");
      }
      return {
        createWritable: async () => ({
          write: async (data: FakeStoredFile) => {
            files.set(fileName, data);
          },
          close: async () => {},
        }),
        getFile: async () => files.get(fileName),
      };
    },
    removeEntry: async (fileName: string) => {
      if (!files.has(fileName)) {
        throw new DOMException("not found", "NotFoundError");
      }
      files.delete(fileName);
    },
    values: () =>
      (async function* () {
        for (const [name, data] of files) {
          yield {
            kind: "file" as const,
            name,
            getFile: async () => data,
          };
        }
      })(),
  });

  const root = {
    getDirectoryHandle: async (name: string, opts?: { create?: boolean }) => {
      if (!dirs.has(name)) {
        if (opts?.create === false) {
          throw new DOMException("not found", "NotFoundError");
        }
        dirs.set(name, new Map());
      }
      return makeDirHandle(dirs.get(name)!);
    },
  };

  return { root, dirs };
}

function installStorage(root: unknown) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { getDirectory: async () => root },
  });
}

const fakeFile = (name: string, content = "data"): FakeStoredFile => ({
  name,
  arrayBuffer: async () => new TextEncoder().encode(content).buffer,
});

describe("fs.web OPFS helpers", () => {
  beforeEach(async () => {
    const { resetStorageWarningsForTests } = await import(
      "@/utils/storage-quota"
    );
    resetStorageWarningsForTests();
    toastWarning.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves files under uuid plus the original extension", async () => {
    const { saveFileToFS } = await import("@/utils/file-system/fs.web");
    const { dirs, root } = makeFakeStorage();
    installStorage(root);

    const fileName = await saveFileToFS(
      "uuid-1",
      fakeFile("hero.glb") as unknown as File,
      "models",
    );

    expect(fileName).toBe("uuid-1.glb");
    expect(dirs.get("models")?.has("uuid-1.glb")).toBe(true);
  });

  it("surfaces a storage-full error and rethrows on quota exceeded", async () => {
    const { saveFileToFS } = await import("@/utils/file-system/fs.web");

    const root = {
      getDirectoryHandle: async () => ({
        getFileHandle: async () => ({
          createWritable: async () => {
            throw new DOMException("full", "QuotaExceededError");
          },
        }),
      }),
    };
    installStorage(root);

    await expect(
      saveFileToFS("uuid-1", fakeFile("hero.glb") as unknown as File, "models"),
    ).rejects.toThrow();
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("does not toast for non-quota write failures", async () => {
    const { saveFileToFS } = await import("@/utils/file-system/fs.web");

    const root = {
      getDirectoryHandle: async () => ({
        getFileHandle: async () => ({
          createWritable: async () => {
            throw new Error("disk on fire");
          },
        }),
      }),
    };
    installStorage(root);

    await expect(
      saveFileToFS("uuid-1", fakeFile("hero.glb") as unknown as File, "models"),
    ).rejects.toThrow("disk on fire");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("finds stored files by uuid prefix", async () => {
    const { getFileFromFS, saveFileToFS } = await import(
      "@/utils/file-system/fs.web"
    );
    const { root } = makeFakeStorage();
    installStorage(root);

    await saveFileToFS(
      "uuid-1",
      fakeFile("hero.glb", "model-bytes") as unknown as File,
      "models",
    );

    const buffer = await getFileFromFS("uuid-1", "models");
    expect(buffer).not.toBeNull();
    expect(new TextDecoder().decode(buffer!)).toBe("model-bytes");

    expect(await getFileFromFS("uuid-2", "models")).toBeNull();
  });

  it("returns null from getFileFromFS when the directory does not exist", async () => {
    const { getFileFromFS } = await import("@/utils/file-system/fs.web");
    const { root } = makeFakeStorage();
    installStorage(root);

    expect(await getFileFromFS("uuid-1", "materials")).toBeNull();
  });

  it("reads stored files back by filename", async () => {
    const { readFileFromFS, saveFileToFS } = await import(
      "@/utils/file-system/fs.web"
    );
    const { root } = makeFakeStorage();
    installStorage(root);

    await saveFileToFS(
      "uuid-1",
      fakeFile("hero.glb") as unknown as File,
      "models",
    );

    const file = await readFileFromFS("uuid-1.glb", "models");
    expect(file.name).toBe("hero.glb");
  });

  it("ignores deletes of files that are already gone", async () => {
    const { deleteFileFromFS, saveFileToFS } = await import(
      "@/utils/file-system/fs.web"
    );
    const { dirs, root } = makeFakeStorage();
    installStorage(root);

    await saveFileToFS(
      "uuid-1",
      fakeFile("hero.glb") as unknown as File,
      "models",
    );

    await deleteFileFromFS("uuid-1.glb", "models");
    expect(dirs.get("models")?.has("uuid-1.glb")).toBe(false);

    await expect(
      deleteFileFromFS("uuid-1.glb", "models"),
    ).resolves.toBeUndefined();
  });
});
