import { describe, expect, it } from "vitest";
import { validateExportRequest } from "@/utils/export-validation";
import { exportRow, frame } from "../helpers/export-fixtures";

describe("export validation", () => {
  it("blocks empty exports", () => {
    const result = validateExportRequest({
      rows: [],
      format: "spritesheet",
      includeNormalMap: false,
    });

    expect(result.blocking).toBe(true);
    expect(result.messages[0].message).toContain("Capture or add");
  });

  it("warns about missing normal coverage", () => {
    const result = validateExportRequest({
      rows: [exportRow("walk", [frame("c0")])],
      format: "spritesheet",
      includeNormalMap: true,
    });

    expect(result.blocking).toBe(false);
    // The headline states the problem; the consequence lives in `detail`, so
    // a narrow surface can print the headline alone without losing meaning.
    expect(result.messages[0].message).toContain("No frames have captured normals");
    expect(result.messages[0].detail).toContain("transparent placeholders");
    expect(result.messages[0].stage).toBe("capture");
  });

  it("warns when the format does not emit normal atlases", () => {
    const result = validateExportRequest({
      rows: [exportRow("walk", [frame("c0")])],
      format: "gif",
      includeNormalMap: true,
    });

    expect(result.blocking).toBe(false);
    expect(result.messages[0].message).toContain("does not emit");
  });

  it("blocks engine exporters when atlas output becomes multi-page", () => {
    const result = validateExportRequest({
      rows: [
        exportRow(
          "walk",
          [frame("c0"), frame("c1"), frame("c2")],
          undefined,
          { frameWidth: 16, frameHeight: 16 },
        ),
      ],
      format: "phaser",
      includeNormalMap: false,
      atlasOptions: {
        maxAtlasSize: 16,
        allowMultiPage: true,
      },
    });

    expect(result.blocking).toBe(true);
    expect(result.messages.some((message) => message.message.includes("multi-page"))).toBe(
      true,
    );
  });

  it("blocks atlas pages that exceed the max size", () => {
    const result = validateExportRequest({
      rows: [
        exportRow("walk", [frame("c0")], undefined, {
          frameWidth: 64,
          frameHeight: 64,
        }),
      ],
      format: "spritesheet",
      includeNormalMap: false,
      atlasOptions: {
        maxAtlasSize: 32,
        allowMultiPage: true,
      },
    });

    expect(result.blocking).toBe(true);
    expect(
      result.messages.some((message) => message.message.includes("exceeds")),
    ).toBe(true);
  });

  it("blocks frames larger than the max atlas size after spacing and scale", () => {
    const result = validateExportRequest({
      rows: [
        exportRow("walk", [frame("c0")], undefined, {
          frameWidth: 15,
          frameHeight: 15,
        }),
      ],
      format: "spritesheet",
      includeNormalMap: false,
      atlasOptions: {
        padding: 2,
        extrude: 2,
        scale: 2,
        maxAtlasSize: 32,
      },
    });

    expect(result.blocking).toBe(true);
    expect(
      result.messages.some((message) =>
        message.message.includes("including padding/extrusion"),
      ),
    ).toBe(true);
  });

  it("warns about padding without edge extrusion", () => {
    const result = validateExportRequest({
      rows: [exportRow("walk", [frame("c0")])],
      format: "spritesheet",
      includeNormalMap: false,
      atlasOptions: { padding: 2, extrude: 0 },
    });

    expect(result.blocking).toBe(false);
    expect(
      result.messages.some((message) =>
        message.message.includes("Padding without extrusion"),
      ),
    ).toBe(true);
  });

  it("notes custom atlas scales", () => {
    const result = validateExportRequest({
      rows: [exportRow("walk", [frame("c0")])],
      format: "spritesheet",
      includeNormalMap: false,
      atlasOptions: { scale: 1.5 },
    });

    expect(result.blocking).toBe(false);
    expect(
      result.messages.some((message) =>
        message.message.includes("Custom atlas scale"),
      ),
    ).toBe(true);
  });
});

describe("repeated frame warnings", () => {
  const frames = (...ids: string[]) => ids.map((id) => frame(id));

  it("says nothing when every frame is different", () => {
    const result = validateExportRequest({
      rows: [exportRow("walk", frames("a", "b", "c"))],
      format: "spritesheet",
      includeNormalMap: false,
    });

    expect(
      result.messages.filter((message) => message.message.includes("repeats")),
    ).toEqual([]);
  });

  it("counts frames identical to the one before them", () => {
    const result = validateExportRequest({
      rows: [exportRow("pose", frames("a", "a", "a", "b"))],
      format: "spritesheet",
      includeNormalMap: false,
    });

    const warning = result.messages.find((message) =>
      message.message.includes("repeats"),
    );

    expect(warning?.severity).toBe("warning");
    expect(warning?.message).toContain('"pose" repeats 2 frames');
    expect(result.blocking).toBe(false);
  });

  it("names each sequence that repeats", () => {
    const result = validateExportRequest({
      rows: [
        exportRow("walk", frames("a", "b")),
        exportRow("idle", frames("c", "c")),
      ],
      format: "spritesheet",
      includeNormalMap: false,
    });

    const warnings = result.messages
      .filter((message) => message.message.includes("repeats"))
      .map((message) => message.message);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"idle" repeats 1 frame');
  });
});
