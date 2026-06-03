import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

vi.mock("@/utils/file-system/fs.web", async () => {
  return {
    getFileFromFS: vi.fn(async (_uuid: string, folder: string) =>
      folder === "materials" ? "texture-data" : null,
    ),
    saveFileToFS: vi.fn(async (uuid: string, file: File) => {
      const ext = file.name.split(".").pop() ?? "bin";
      return `${uuid}.${ext}`;
    }),
    readFileFromFS: vi.fn(),
    readFile: vi.fn(),
  };
});

describe("material project persistence", () => {
  beforeEach(async () => {
    const { useMaterialsStore } = await import("@/store/next/materials");
    useMaterialsStore.getState().reset();
  });

  it("bundles material texture files into project archives", async () => {
    const { useMaterialsStore } = await import("@/store/next/materials");
    const { useProjectStore } = await import("@/store/next/project");

    useMaterialsStore.getState().hydrate({
      materials: {},
      assignments: {},
      textures: {
        "texture-a": {
          uuid: "texture-a",
          name: "Albedo",
          fileName: "texture-a.png",
          filePath: "texture-a.png",
          mimeType: "image/png",
          size: 12,
          createdAt: 1,
        },
      },
    });

    const snapshot = useProjectStore.getState().snapshot();
    const blob = await useProjectStore.getState().buildZipBlob(snapshot);
    const zip = await JSZip.loadAsync(blob);

    expect(zip.file("materials/texture-a.png")).toBeTruthy();
    expect(await zip.file("materials/texture-a.png")!.async("string")).toBe(
      "texture-data",
    );
  });
});
