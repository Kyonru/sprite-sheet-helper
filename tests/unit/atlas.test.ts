import { describe, expect, it } from "vitest";
import {
  atlasPageFileName,
  createAtlasPlan,
  createSpritesheetJSONFromAtlasPlan,
} from "@/utils/atlas";
import { exportRow, frame } from "../helpers/export-fixtures";

describe("atlas planner", () => {
  const placementsOverlap = (
    a: { page: number; slotX: number; slotY: number; slotW: number; slotH: number },
    b: { page: number; slotX: number; slotY: number; slotW: number; slotH: number },
  ) =>
    a.page === b.page &&
    a.slotX < b.slotX + b.slotW &&
    a.slotX + a.slotW > b.slotX &&
    a.slotY < b.slotY + b.slotH &&
    a.slotY + a.slotH > b.slotY;

  it("keeps legacy row layout with default options", () => {
    const rows = [
      exportRow("walk", [frame("a"), frame("b")], undefined, {
        frameWidth: 16,
        frameHeight: 12,
      }),
      exportRow("idle", [frame("c")], undefined, {
        frameWidth: 10,
        frameHeight: 6,
      }),
    ];

    const plan = createAtlasPlan(rows);

    expect(plan.pages).toEqual([{ index: 0, width: 32, height: 18 }]);
    expect(plan.placements.map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual([
      { x: 0, y: 0, w: 16, h: 12 },
      { x: 16, y: 0, w: 16, h: 12 },
      { x: 0, y: 12, w: 10, h: 6 },
    ]);
  });

  it("adds padding, extrusion, and scale while keeping quads on content rects", () => {
    const rows = [
      exportRow("walk", [frame("a")], undefined, {
        frameWidth: 8,
        frameHeight: 4,
      }),
    ];

    const plan = createAtlasPlan(rows, {
      padding: 2,
      extrude: 1,
      scale: 2,
    });

    expect(plan.pages).toEqual([{ index: 0, width: 22, height: 14 }]);
    expect(plan.placements[0]).toMatchObject({
      x: 3,
      y: 3,
      w: 16,
      h: 8,
      slotW: 22,
      slotH: 14,
    });
  });

  it("creates deterministic packed plans", () => {
    const rows = [
      exportRow("tall", [frame("a")], undefined, {
        frameWidth: 8,
        frameHeight: 32,
      }),
      exportRow("short", [frame("b"), frame("c")], undefined, {
        frameWidth: 16,
        frameHeight: 8,
      }),
    ];

    const first = createAtlasPlan(rows, { layout: "packed" });
    const second = createAtlasPlan(rows, { layout: "packed" });

    expect(second).toEqual(first);
    expect(first.pages[0].height).toBeLessThan(40);
  });

  it("packs with MaxRects without overlap or frame rotation", () => {
    const rows = [
      exportRow("tall", [frame("a")], undefined, {
        frameWidth: 10,
        frameHeight: 28,
      }),
      exportRow("wide", [frame("b")], undefined, {
        frameWidth: 28,
        frameHeight: 10,
      }),
      exportRow("square", [frame("c")], undefined, {
        frameWidth: 12,
        frameHeight: 12,
      }),
      exportRow("leg", [frame("d")], undefined, {
        frameWidth: 6,
        frameHeight: 20,
      }),
    ];

    const plan = createAtlasPlan(rows, {
      layout: "packed",
      maxAtlasSize: 40,
      allowMultiPage: true,
    });

    for (let index = 0; index < plan.placements.length; index += 1) {
      const placement = plan.placements[index];
      const row = rows[placement.rowIndex];
      expect(placement.w).toBe(row.frameWidth);
      expect(placement.h).toBe(row.frameHeight);
      for (let next = index + 1; next < plan.placements.length; next += 1) {
        expect(placementsOverlap(placement, plan.placements[next])).toBe(false);
      }
    }
  });

  it("splits packed atlases into deterministic pages", () => {
    const rows = [
      exportRow(
        "walk",
        [frame("a"), frame("b"), frame("c"), frame("d"), frame("e")],
        undefined,
        { frameWidth: 16, frameHeight: 16 },
      ),
    ];

    const first = createAtlasPlan(rows, {
      layout: "packed",
      maxAtlasSize: 32,
      allowMultiPage: true,
    });
    const second = createAtlasPlan(rows, {
      layout: "packed",
      maxAtlasSize: 32,
      allowMultiPage: true,
    });

    expect(second).toEqual(first);
    expect(first.pages.map((page) => `${page.width}x${page.height}`)).toEqual([
      "32x32",
      "16x16",
    ]);
  });

  it("splits rows into pages when multi-page is enabled", () => {
    const rows = [
      exportRow(
        "walk",
        [frame("a"), frame("b"), frame("c"), frame("d"), frame("e")],
        undefined,
        { frameWidth: 16, frameHeight: 16 },
      ),
    ];

    const plan = createAtlasPlan(rows, {
      maxAtlasSize: 32,
      allowMultiPage: true,
    });

    expect(plan.pages.length).toBe(2);
    expect(plan.pages.map((page) => `${page.width}x${page.height}`)).toEqual([
      "32x32",
      "16x16",
    ]);
  });

  it("adds multi-page JSON metadata without changing single-page shape", () => {
    const rows = [
      exportRow(
        "walk",
        [frame("a"), frame("b"), frame("c")],
        undefined,
        { frameWidth: 16, frameHeight: 16 },
      ),
    ];
    const single = createSpritesheetJSONFromAtlasPlan(
      rows,
      createAtlasPlan(rows),
    );
    const multi = createSpritesheetJSONFromAtlasPlan(
      rows,
      createAtlasPlan(rows, { maxAtlasSize: 16, allowMultiPage: true }),
      "spritesheet.png",
      "spritesheet_normal.png",
    );

    expect(single.meta.pages).toBeUndefined();
    expect(single.animations[0].quads[0].page).toBeUndefined();
    expect(multi.meta.pages?.map((page) => page.image)).toEqual([
      "spritesheet.png",
      "spritesheet_2.png",
      "spritesheet_3.png",
    ]);
    expect(multi.animations[0].quads.map((quad) => quad.page)).toEqual([
      0, 1, 2,
    ]);
  });

  it("creates page-specific file names", () => {
    expect(atlasPageFileName("spritesheet.png", 0)).toBe("spritesheet.png");
    expect(atlasPageFileName("spritesheet.png", 1)).toBe("spritesheet_2.png");
    expect(atlasPageFileName("assets/sheet.normal.png", 2)).toBe(
      "assets/sheet.normal_3.png",
    );
  });
});
