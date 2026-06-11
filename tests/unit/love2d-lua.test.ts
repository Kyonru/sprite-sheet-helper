import { describe, expect, it } from "vitest";
import luaparse from "luaparse";
import {
  createAnim8Lua,
  createLuaExample,
  createVanillaLua,
} from "@/utils/exports/love2d";
import type { SpritesheetJSON } from "@/utils/assets";

const json: SpritesheetJSON = {
  meta: {
    version: "1.0",
    exportedAt: "2026-06-11T00:00:00.000Z",
    imageWidth: 128,
    imageHeight: 64,
    frameCount: 4,
    animationCount: 2,
    spacing: 0,
    margin: 0,
  },
  animations: [
    {
      name: "walk",
      frames: 2,
      fps: 8,
      frameWidth: 32,
      frameHeight: 32,
      quads: [
        { x: 0, y: 0, w: 32, h: 32 },
        { x: 32, y: 0, w: 32, h: 32 },
      ],
    },
    {
      name: "idle",
      frames: 2,
      fps: 4,
      frameWidth: 32,
      frameHeight: 32,
      quads: [
        { x: 0, y: 32, w: 32, h: 32 },
        { x: 32, y: 32, w: 32, h: 32 },
      ],
    },
  ],
};

describe("love2d lua generators", () => {
  it("generates valid vanilla Lua with one quad per frame", () => {
    const code = createVanillaLua(json);

    expect(() => luaparse.parse(code)).not.toThrow();
    expect(code).toContain('animations["walk"]');
    expect(code).toContain('animations["idle"]');
    expect(code).toContain(
      "love.graphics.newQuad(0, 0, 32, 32, iw, ih)",
    );
    expect(code).toContain(
      "love.graphics.newQuad(32, 32, 32, 32, iw, ih)",
    );
    expect(code).toContain("fps = 8,");
    expect(code).toContain("fps = 4,");
  });

  it("respects a custom image path", () => {
    const code = createVanillaLua(json, "assets/hero.png");
    expect(code).toContain('imagePath or "assets/hero.png"');
  });

  it("generates valid anim8 Lua with grids anchored at each animation origin", () => {
    const code = createAnim8Lua(json);

    expect(() => luaparse.parse(code)).not.toThrow();
    // walk starts at (0, 0), idle at (0, 32)
    expect(code).toContain("anim8.newGrid(32, 32, iw, ih, 0, 0)");
    expect(code).toContain("anim8.newGrid(32, 32, iw, ih, 0, 32)");
    // 2 frames on row 1, frame duration = 1/8s
    expect(code).toContain('g("1-2", 1), 0.125');
    expect(code).toContain('g("1-2", 1), 0.25');
  });

  it("generates a runnable example using the first animation", () => {
    const code = createLuaExample(json);

    expect(() => luaparse.parse(code)).not.toThrow();
    expect(code).toContain('spritesheet.update(sheet, "walk", dt)');
  });

  it("falls back to a default animation name in the example", () => {
    const code = createLuaExample({ ...json, animations: [] });
    expect(code).toContain('"walk"');
  });
});
