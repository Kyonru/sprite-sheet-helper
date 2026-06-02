import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSpriteSheet } from "@/utils/assets";
import { SpritesheetExporter } from "@/utils/exports/spritesheet";
import { phaserExporter } from "@/utils/exports/phaser";
import { bevyExporter } from "@/utils/exports/bevy";
import { love2dVanillaExporter } from "@/utils/exports/love2d";
import { exportRow, frame } from "../helpers/export-fixtures";

vi.mock("@/utils/assets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/assets")>();
  return {
    ...actual,
    createSpriteSheet: vi.fn(),
  };
});

const createSpriteSheetMock = vi.mocked(createSpriteSheet);

const rows = [
  exportRow("walk", [frame("c0"), frame("c1")], [frame("n0"), frame("n1")]),
];

describe("spritesheet atlas exporters", () => {
  beforeEach(() => {
    createSpriteSheetMock.mockResolvedValue("data:image/png;base64,atlas");
  });

  it.each([
    [SpritesheetExporter.label, SpritesheetExporter, "spritesheet_normal.png"],
    [phaserExporter.label, phaserExporter, "spritesheet_normal.png"],
    [love2dVanillaExporter.label, love2dVanillaExporter, "spritesheet_normal.png"],
    [bevyExporter.label, bevyExporter, "assets/spritesheet_normal.png"],
  ])("%s includes normal atlases when requested", async (_, exporter, normalFile) => {
    const result = await exporter.run({
      exportedImages: rows,
      frameDelay: 100,
      includeNormalMap: true,
    });

    expect(result.files.map((file) => file.name)).toContain(normalFile);
  });

  it.each([
    [SpritesheetExporter.label, SpritesheetExporter],
    [phaserExporter.label, phaserExporter],
    [love2dVanillaExporter.label, love2dVanillaExporter],
    [bevyExporter.label, bevyExporter],
  ])("%s omits normal atlases when disabled", async (_, exporter) => {
    const result = await exporter.run({
      exportedImages: rows,
      frameDelay: 100,
      includeNormalMap: false,
    });

    expect(
      result.files.some((file) => file.name.includes("spritesheet_normal.png")),
    ).toBe(false);
  });

  it("writes normal metadata into spritesheet JSON only when requested", async () => {
    const withNormals = await SpritesheetExporter.run({
      exportedImages: rows,
      frameDelay: 100,
      includeNormalMap: true,
    });
    const withoutNormals = await SpritesheetExporter.run({
      exportedImages: rows,
      frameDelay: 100,
      includeNormalMap: false,
    });
    const jsonWithNormals = JSON.parse(
      withNormals.files.find((file) => file.name === "spritesheet.json")!
        .content as string,
    ) as { meta: { normalImage?: string } };
    const jsonWithoutNormals = JSON.parse(
      withoutNormals.files.find((file) => file.name === "spritesheet.json")!
        .content as string,
    ) as { meta: { normalImage?: string } };

    expect(jsonWithNormals.meta.normalImage).toBe("spritesheet_normal.png");
    expect(jsonWithoutNormals.meta.normalImage).toBeUndefined();
  });
});
