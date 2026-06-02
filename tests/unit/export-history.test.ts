import { beforeEach, describe, expect, it } from "vitest";
import {
  addExportHistoryEntry,
  clearExportHistory,
  loadExportHistory,
  saveExportHistory,
  type ExportHistoryEntry,
} from "@/utils/export-history";
import { DEFAULT_ATLAS_OPTIONS } from "@/utils/atlas";

const entry = (index: number): ExportHistoryEntry => ({
  id: `${index}`,
  timestamp: new Date(index).toISOString(),
  format: "spritesheet",
  filename: `spritesheet-${index}.zip`,
  frameCount: index,
  animationCount: 1,
  pageCount: 1,
  normalStatus: "ready",
  atlasOptions: DEFAULT_ATLAS_OPTIONS,
  warnings: [],
});

describe("export history", () => {
  beforeEach(() => {
    clearExportHistory();
  });

  it("saves and loads local export history", () => {
    saveExportHistory([entry(1), entry(2)]);

    expect(loadExportHistory().map((item) => item.filename)).toEqual([
      "spritesheet-1.zip",
      "spritesheet-2.zip",
    ]);
  });

  it("adds new entries first and limits stored history", () => {
    saveExportHistory(Array.from({ length: 12 }, (_, index) => entry(index)));

    const next = addExportHistoryEntry({
      format: "phaser",
      filename: "phaser.zip",
      frameCount: 4,
      animationCount: 1,
      pageCount: 1,
      normalStatus: "missing",
      atlasOptions: DEFAULT_ATLAS_OPTIONS,
      warnings: ["Missing normals"],
    });

    expect(next).toHaveLength(12);
    expect(next[0]).toMatchObject({
      format: "phaser",
      filename: "phaser.zip",
      warnings: ["Missing normals"],
    });
  });
});
