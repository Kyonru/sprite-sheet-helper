import { describe, expect, it } from "vitest";
import { createGodotExample, createGodotGD } from "@/utils/exports/godot";
import { createUnityCS, createUnityExample } from "@/utils/exports/unity";
import { createPygameExample, createPygamePy } from "@/utils/exports/pygame";
import { createRaylibExample, createRaylibH } from "@/utils/exports/raylib";
import { createTurboExample, createTurboRust } from "@/utils/exports/turbo";
import { zipExporter } from "@/utils/exports/zip";
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

type Quad = SpritesheetJSON["animations"][number]["quads"][number];

const cases = [
  {
    engine: "godot",
    generate: (j: SpritesheetJSON) => createGodotGD(j),
    example: (j: SpritesheetJSON) => createGodotExample(j),
    quad: (q: Quad) => `Rect2(${q.x}, ${q.y}, ${q.w}, ${q.h})`,
    fps: [/set_animation_speed\(&"walk", 8\)/, /set_animation_speed\(&"idle", 4\)/],
  },
  {
    engine: "unity",
    generate: (j: SpritesheetJSON) => createUnityCS(j),
    example: (j: SpritesheetJSON) => createUnityExample(j),
    quad: (q: Quad) =>
      `new FrameRect { X = ${q.x}, Y = ${q.y}, W = ${q.w}, H = ${q.h} }`,
    fps: [/Fps\s*=\s*8f/, /Fps\s*=\s*4f/],
  },
  {
    engine: "pygame",
    generate: (j: SpritesheetJSON) => createPygamePy(j),
    example: (j: SpritesheetJSON) => createPygameExample(j),
    quad: (q: Quad) => `pygame.Rect(${q.x}, ${q.y}, ${q.w}, ${q.h})`,
    fps: [/fps=8,/, /fps=4,/],
  },
  {
    engine: "raylib",
    generate: (j: SpritesheetJSON) => createRaylibH(j),
    example: (j: SpritesheetJSON) => createRaylibExample(j),
    quad: (q: Quad) =>
      `{ ${q.x}.0f, ${q.y}.0f, ${q.w}.0f, ${q.h}.0f }`,
    fps: [/fps\s*=\s*8/, /fps\s*=\s*4/],
  },
  {
    engine: "turbo",
    generate: (j: SpritesheetJSON) => createTurboRust(j),
    example: (j: SpritesheetJSON) => createTurboExample(j),
    quad: (q: Quad) =>
      `AnimationFrame { x: ${q.x}, y: ${q.y}, w: ${q.w}, h: ${q.h} }`,
    fps: [/fps: 8_f32/, /fps: 4_f32/],
  },
];

describe("engine code generators", () => {
  it.each(cases)(
    "$engine embeds every animation with its frames and fps",
    ({ generate, quad, fps }) => {
      const code = generate(json);

      for (const anim of json.animations) {
        expect(code).toMatch(new RegExp(anim.name, "i"));
        for (const q of anim.quads) {
          expect(code).toContain(quad(q));
        }
      }
      for (const pattern of fps) {
        expect(code).toMatch(pattern);
      }
    },
  );

  it.each(cases)(
    "$engine example references the first animation",
    ({ example }) => {
      expect(example(json)).toMatch(/walk/i);
    },
  );

  it.each(cases)(
    "$engine tolerates an empty animation list",
    ({ generate, example }) => {
      const empty = { ...json, animations: [] };
      expect(() => generate(empty)).not.toThrow();
      // Examples fall back to a placeholder animation name.
      expect(example(empty)).toMatch(/walk/i);
    },
  );
});

describe("zip exporter", () => {
  it("emits one base64 file per frame, grouped by animation", async () => {
    const result = await zipExporter.run({
      exportedImages: [
        {
          uuid: "uuid-1",
          label: "walk",
          images: ["aaa", "bbb"],
          frameWidth: 16,
          frameHeight: 16,
          fps: 8,
        },
        {
          uuid: "uuid-2",
          label: "idle",
          images: ["ccc"],
          frameWidth: 16,
          frameHeight: 16,
          fps: 8,
        },
      ],
      frameDelay: 100,
      includeNormalMap: false,
    });

    expect(result.filename).toBe("images.zip");
    expect(result.files.map((file) => file.name)).toEqual([
      "walk/uuid-1_0.png",
      "walk/uuid-1_1.png",
      "idle/uuid-2_0.png",
    ]);
    expect(result.files.every((file) => file.base64)).toBe(true);
  });
});
