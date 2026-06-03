import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportRow } from "@/types/file";
import { renderAtlasPages } from "@/utils/atlas-renderer";
import { buildSpritesheetAssets } from "@/utils/exports/helpers";
import { exportRow, frame } from "../helpers/export-fixtures";

vi.mock("@/utils/atlas-renderer", () => {
  return { renderAtlasPages: vi.fn() };
});

const renderAtlasPagesMock = vi.mocked(renderAtlasPages);

const encodeRows = (rows: ExportRow[]) =>
  Buffer.from(JSON.stringify(rows.map((row) => row.images))).toString("base64");

describe("buildSpritesheetAssets", () => {
  beforeEach(() => {
    renderAtlasPagesMock.mockImplementation(
      async (rows, plan) =>
        plan.pages.map(
          (page) =>
            `data:image/png;base64,${encodeRows(rows)}-${page.index}`,
        ),
    );
  });

  it("does not emit a normal atlas when normal maps are disabled", async () => {
    const rows = [
      exportRow("walk", [frame("c0")], [frame("n0")]),
      exportRow("idle", [frame("c1")], [frame("n1")]),
    ];

    const result = await buildSpritesheetAssets(rows, {
      includeNormalMap: false,
    });

    expect(result.normalBase64PNG).toBeUndefined();
    expect(result.json.meta.normalImage).toBeUndefined();
    expect(result.manifest.atlas.pages[0].normalImage).toBeUndefined();
    expect(renderAtlasPagesMock).toHaveBeenCalledTimes(1);
  });

  it("emits a standardized spritesheet manifest", async () => {
    const rows = [
      exportRow("walk", [frame("c0"), frame("c1")], undefined, {
        frameWidth: 8,
        frameHeight: 6,
      }),
    ];

    const result = await buildSpritesheetAssets(rows, {
      atlasOptions: { layout: "packed", padding: 2, extrude: 1, scale: 2 },
      exporterId: "phaser",
    });
    const manifest = JSON.parse(result.manifestFile.content);

    expect(result.manifestFile.name).toBe("spritesheet.manifest.json");
    expect(manifest.exporterId).toBe("phaser");
    expect(manifest.atlas).toMatchObject({
      layout: "packed",
      padding: 2,
      extrude: 1,
      scale: 2,
      pageCount: 1,
    });
    expect(manifest.animations[0]).toMatchObject({
      name: "walk",
      frameWidth: 16,
      frameHeight: 12,
    });
    expect(manifest.animations[0].frames[0]).toMatchObject({
      index: 0,
      page: 0,
      image: "spritesheet.png",
      rect: { w: 16, h: 12 },
      slot: { w: 22, h: 18 },
      source: { width: 8, height: 6 },
    });
  });

  it("emits a matching normal atlas when all frames have normals", async () => {
    const rows = [
      exportRow(
        "walk",
        [frame("c0"), frame("c1")],
        [frame("n0"), frame("n1")],
      ),
    ];

    const result = await buildSpritesheetAssets(rows, {
      includeNormalMap: true,
    });

    expect(result.json.meta.normalImage).toBe("spritesheet_normal.png");
    expect(result.normalBase64PNG).toBe(
      `${encodeRows([{ ...rows[0], images: [frame("n0"), frame("n1")] }])}-0`,
    );
    expect(result.manifest.atlas.pages[0].normalImage).toBe(
      "spritesheet_normal.png",
    );
    expect(renderAtlasPagesMock).toHaveBeenCalledTimes(2);
  });

  it("fills missing normals with transparent placeholder frames", async () => {
    const rows = [
      exportRow("walk", [frame("c0"), frame("c1")], [frame("n0")]),
    ];

    await buildSpritesheetAssets(rows, { includeNormalMap: true });

    expect(renderAtlasPagesMock).toHaveBeenLastCalledWith([
      {
        ...rows[0],
        images: [frame("n0"), "transparent-frame"],
      },
      ],
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("uses a custom normal image metadata path", async () => {
    const result = await buildSpritesheetAssets(
      [exportRow("walk", [frame("c0")])],
      {
        includeNormalMap: true,
        normalImageName: "assets/spritesheet_normal.png",
      },
    );

    expect(result.json.meta.normalImage).toBe("assets/spritesheet_normal.png");
  });

  it("emits multi-page atlas files from the shared plan", async () => {
    const rows = [
      exportRow(
        "walk",
        [frame("c0"), frame("c1"), frame("c2"), frame("c3"), frame("c4")],
        undefined,
        {
          frameWidth: 16,
          frameHeight: 16,
        },
      ),
    ];

    const result = await buildSpritesheetAssets(rows, {
      atlasOptions: {
        layout: "rows",
        maxAtlasSize: 32,
        allowMultiPage: true,
      },
    });

    expect(result.pageCount).toBeGreaterThan(1);
    expect(result.colorPages.map((file) => file.name)).toEqual([
      "spritesheet.png",
      "spritesheet_2.png",
    ]);
    expect(result.json.meta.pages?.map((page) => page.image)).toEqual([
      "spritesheet.png",
      "spritesheet_2.png",
    ]);
    expect(result.manifest.atlas.pages.map((page) => page.image)).toEqual([
      "spritesheet.png",
      "spritesheet_2.png",
    ]);
  });

  it("places manifests beside asset-path atlas files", async () => {
    const result = await buildSpritesheetAssets(
      [exportRow("walk", [frame("c0")])],
      {
        imageName: "assets/spritesheet.png",
        normalImageName: "assets/spritesheet_normal.png",
        includeNormalMap: true,
        exporterId: "bevy",
      },
    );

    expect(result.manifestFile.name).toBe("assets/spritesheet.manifest.json");
    expect(result.manifest.atlas.pages[0]).toMatchObject({
      image: "assets/spritesheet.png",
      normalImage: "assets/spritesheet_normal.png",
    });
  });
});
