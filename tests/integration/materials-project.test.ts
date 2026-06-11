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
    readFileFromFS: vi.fn(async (fileName: string, folder: string) => {
      if (folder === "models") {
        return new File(["model-data"], fileName, {
          type: "model/gltf-binary",
        });
      }
      throw new Error("not found");
    }),
    readFile: vi.fn(),
  };
});

describe("material project persistence", () => {
  beforeEach(async () => {
    const { useMaterialsStore } = await import("@/store/next/materials");
    const { useModelsStore } = await import("@/store/next/models");
    const fs = await import("@/utils/file-system/fs.web");

    useMaterialsStore.getState().reset();
    useModelsStore.getState().reset();
    vi.mocked(fs.saveFileToFS).mockClear();
    vi.mocked(fs.readFileFromFS).mockClear();
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

  it("adds debug context to project archives when requested", async () => {
    const { useProjectStore } = await import("@/store/next/project");

    const snapshot = useProjectStore.getState().snapshot();
    const blob = await useProjectStore.getState().buildZipBlob(snapshot, {
      timestamp: "2026-06-11T00:00:00.000Z",
      source: "unit-test",
      message: "Crash context",
    });
    const zip = await JSZip.loadAsync(blob);
    const debugTrail = await zip.file("debug-trail.json")?.async("string");
    const projectArchive = await zip.file("project.sshProj")?.async("blob");

    expect(debugTrail).toBeTruthy();
    expect(JSON.parse(debugTrail!)).toEqual({
      timestamp: "2026-06-11T00:00:00.000Z",
      source: "unit-test",
      message: "Crash context",
    });
    expect(projectArchive).toBeTruthy();

    const projectZip = await JSZip.loadAsync(projectArchive!);
    expect(projectZip.file("project.json")).toBeTruthy();
  });

  it("reattaches OPFS model files during snapshot restore without resaving them", async () => {
    const { useModelsStore } = await import("@/store/next/models");
    const { useProjectStore } = await import("@/store/next/project");
    const fs = await import("@/utils/file-system/fs.web");

    useModelsStore.getState().hydrate({
      models: {
        "model-a": {
          source: "file",
          fileName: "hero.glb",
          filePath: "model-a.glb",
          type: "model/gltf-binary",
          fileSize: 10,
          format: "glb",
          loadState: "idle",
          errorMessage: null,
        },
      },
      clips: {},
      mixerRef: {},
      animations: {},
      durations: {},
      speeds: {},
      loops: {},
      currentTime: {},
      frameStep: {},
      freeze: {},
    });

    const snapshot = useProjectStore.getState().snapshot();
    const attachStoredFile = vi.spyOn(
      useModelsStore.getState(),
      "attachStoredFile",
    );

    await useProjectStore.getState().applySnapshot(snapshot);

    expect(fs.readFileFromFS).toHaveBeenCalledWith("model-a.glb", "models");
    expect(fs.saveFileToFS).not.toHaveBeenCalled();
    expect(attachStoredFile).toHaveBeenCalledWith(
      "model-a",
      expect.any(File),
      "model-a.glb",
      expect.objectContaining({
        fileName: "hero.glb",
        filePath: "model-a.glb",
      }),
    );
    expect(useModelsStore.getState().models["model-a"].loadState).toBe(
      "loading",
    );
    expect(useModelsStore.getState().models["model-a"].autoFitOnLoad).toBe(true);
  });
});
