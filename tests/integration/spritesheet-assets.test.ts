import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportRow } from "@/types/file";
import { createSpriteSheet } from "@/utils/assets";
import { buildSpritesheetAssets } from "@/utils/exports/helpers";
import { exportRow, frame } from "../helpers/export-fixtures";

vi.mock("@/utils/assets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/assets")>();
  return {
    ...actual,
    createSpriteSheet: vi.fn(),
  };
});

const createSpriteSheetMock = vi.mocked(createSpriteSheet);

const encodeRows = (rows: ExportRow[]) =>
  Buffer.from(JSON.stringify(rows.map((row) => row.images))).toString("base64");

describe("buildSpritesheetAssets", () => {
  beforeEach(() => {
    createSpriteSheetMock.mockImplementation(
      async (rows) => `data:image/png;base64,${encodeRows(rows)}`,
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
    expect(createSpriteSheetMock).toHaveBeenCalledTimes(1);
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
    expect(result.normalBase64PNG).toBe(encodeRows([
      { ...rows[0], images: [frame("n0"), frame("n1")] },
    ]));
    expect(createSpriteSheetMock).toHaveBeenCalledTimes(2);
  });

  it("fills missing normals with transparent placeholder frames", async () => {
    const rows = [
      exportRow("walk", [frame("c0"), frame("c1")], [frame("n0")]),
    ];

    await buildSpritesheetAssets(rows, { includeNormalMap: true });

    expect(createSpriteSheetMock).toHaveBeenLastCalledWith([
      {
        ...rows[0],
        images: [frame("n0"), "transparent-frame"],
      },
    ]);
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
});
