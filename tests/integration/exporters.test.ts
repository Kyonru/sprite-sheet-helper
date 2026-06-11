import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAtlasPages } from "@/utils/atlas-renderer";
import { SpritesheetExporter } from "@/utils/exports/spritesheet";
import { phaserExporter } from "@/utils/exports/phaser";
import { bevyExporter } from "@/utils/exports/bevy";
import { love2dVanillaExporter, love2dAnim8Exporter } from "@/utils/exports/love2d";
import { godotExporter } from "@/utils/exports/godot";
import { unityExporter } from "@/utils/exports/unity";
import { pygameExporter } from "@/utils/exports/pygame";
import { raylibExporter } from "@/utils/exports/raylib";
import { turboRustExporter } from "@/utils/exports/turbo";
import { exportRow, frame } from "../helpers/export-fixtures";

vi.mock("@/utils/atlas-renderer", () => {
  return { renderAtlasPages: vi.fn() };
});

const renderAtlasPagesMock = vi.mocked(renderAtlasPages);

const rows = [
  exportRow("walk", [frame("c0"), frame("c1")], [frame("n0"), frame("n1")]),
];

describe("spritesheet atlas exporters", () => {
  beforeEach(() => {
    renderAtlasPagesMock.mockImplementation(async (_rows, plan) =>
      plan.pages.map((page) => `data:image/png;base64,atlas-${page.index}`),
    );
  });

  it.each([
    [SpritesheetExporter.label, SpritesheetExporter, "spritesheet_normal.png"],
    [phaserExporter.label, phaserExporter, "spritesheet_normal.png"],
    [love2dVanillaExporter.label, love2dVanillaExporter, "spritesheet_normal.png"],
    [love2dAnim8Exporter.label, love2dAnim8Exporter, "spritesheet_normal.png"],
    [godotExporter.label, godotExporter, "spritesheet_normal.png"],
    [unityExporter.label, unityExporter, "spritesheet_normal.png"],
    [pygameExporter.label, pygameExporter, "spritesheet_normal.png"],
    [raylibExporter.label, raylibExporter, "spritesheet_normal.png"],
    [turboRustExporter.label, turboRustExporter, "spritesheet_normal.png"],
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
    [love2dAnim8Exporter.label, love2dAnim8Exporter],
    [godotExporter.label, godotExporter],
    [unityExporter.label, unityExporter],
    [pygameExporter.label, pygameExporter],
    [raylibExporter.label, raylibExporter],
    [turboRustExporter.label, turboRustExporter],
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

  it.each([
    [SpritesheetExporter.label, SpritesheetExporter, "spritesheet.manifest.json"],
    [phaserExporter.label, phaserExporter, "spritesheet.manifest.json"],
    [love2dVanillaExporter.label, love2dVanillaExporter, "spritesheet.manifest.json"],
    [love2dAnim8Exporter.label, love2dAnim8Exporter, "spritesheet.manifest.json"],
    [godotExporter.label, godotExporter, "spritesheet.manifest.json"],
    [unityExporter.label, unityExporter, "spritesheet.manifest.json"],
    [pygameExporter.label, pygameExporter, "spritesheet.manifest.json"],
    [raylibExporter.label, raylibExporter, "spritesheet.manifest.json"],
    [turboRustExporter.label, turboRustExporter, "spritesheet.manifest.json"],
    [bevyExporter.label, bevyExporter, "assets/spritesheet.manifest.json"],
  ])("%s includes the shared atlas manifest", async (_, exporter, manifestFile) => {
    const result = await exporter.run({
      exportedImages: rows,
      frameDelay: 100,
      includeNormalMap: true,
    });

    expect(result.files.map((file) => file.name)).toContain(manifestFile);
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

  it("lets generic spritesheet export multi-page atlases", async () => {
    const result = await SpritesheetExporter.run({
      exportedImages: [
        exportRow("walk", [frame("c0"), frame("c1"), frame("c2")], undefined, {
          frameWidth: 16,
          frameHeight: 16,
        }),
      ],
      frameDelay: 100,
      includeNormalMap: false,
      atlasOptions: {
        layout: "rows",
        maxAtlasSize: 24,
        allowMultiPage: true,
      },
    });

    expect(result.files.map((file) => file.name)).toContain(
      "spritesheet_2.png",
    );
  });

  it.each([
    [phaserExporter.label, phaserExporter],
    [love2dVanillaExporter.label, love2dVanillaExporter],
    [love2dAnim8Exporter.label, love2dAnim8Exporter],
    [godotExporter.label, godotExporter],
    [unityExporter.label, unityExporter],
    [pygameExporter.label, pygameExporter],
    [raylibExporter.label, raylibExporter],
    [turboRustExporter.label, turboRustExporter],
    [bevyExporter.label, bevyExporter],
  ])("%s blocks unsafe multi-page output", async (_, exporter) => {
    await expect(
      exporter.run({
        exportedImages: [
          exportRow(
            "walk",
            [frame("c0"), frame("c1"), frame("c2")],
            undefined,
            {
              frameWidth: 16,
              frameHeight: 16,
            },
          ),
        ],
        frameDelay: 100,
        includeNormalMap: false,
        atlasOptions: {
          layout: "rows",
          maxAtlasSize: 24,
          allowMultiPage: true,
        },
      }),
    ).rejects.toThrow("does not support multi-page");
  });
});
