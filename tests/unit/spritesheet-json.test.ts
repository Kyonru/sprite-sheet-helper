import { describe, expect, it } from "vitest";
import { createSpritesheetJSON } from "@/utils/assets";
import { exportRow, frame } from "../helpers/export-fixtures";
import type { ExportRowMetadata } from "@/types/file";

const workflowMetadata = (
  directionLabel: string,
): ExportRowMetadata => ({
  workflow: {
    workflowId: "topdown-4dir",
    workflowLabel: "Top Down 4-directional",
    modelUuid: "model-a",
    animationName: "walk",
    directionLabel,
  },
});

describe("createSpritesheetJSON", () => {
  it("creates atlas metadata and quads matching row order", () => {
    const rows = [
      exportRow("walk", [frame("walk-0"), frame("walk-1")], undefined, {
        frameWidth: 16,
        frameHeight: 12,
        fps: 8,
      }),
      exportRow("idle", [frame("idle-0")], undefined, {
        frameWidth: 10,
        frameHeight: 6,
        fps: 4,
      }),
    ];

    const json = createSpritesheetJSON(rows, { spacing: 2, margin: 1 });

    expect(json.meta).toMatchObject({
      imageWidth: 36,
      imageHeight: 22,
      frameCount: 3,
      animationCount: 2,
      spacing: 2,
      margin: 1,
    });
    expect(json.animations).toEqual([
      {
        name: "walk",
        frames: 2,
        fps: 8,
        frameWidth: 16,
        frameHeight: 12,
        quads: [
          { x: 1, y: 1, w: 16, h: 12 },
          { x: 19, y: 1, w: 16, h: 12 },
        ],
      },
      {
        name: "idle",
        frames: 1,
        fps: 4,
        frameWidth: 10,
        frameHeight: 6,
        quads: [{ x: 1, y: 15, w: 10, h: 6 }],
      },
    ]);
  });

  it("groups workflow rows that are directions of the same animation", () => {
    const rows = [
      exportRow("walk_N", [frame("walk-n")], undefined, {
        metadata: workflowMetadata("N"),
      }),
      exportRow("walk_E", [frame("walk-e")], undefined, {
        metadata: workflowMetadata("E"),
      }),
    ];

    const json = createSpritesheetJSON(rows);

    expect(json.animations[0].workflow).toEqual({
      workflowId: "topdown-4dir",
      workflowLabel: "Top Down 4-directional",
      modelUuid: "model-a",
      animationName: "walk",
      directionLabel: "N",
    });
    expect(json.directionalAnimations).toEqual([
      {
        name: "walk",
        workflowId: "topdown-4dir",
        workflowLabel: "Top Down 4-directional",
        modelUuid: "model-a",
        directions: [
          { label: "N", animation: "walk_N" },
          { label: "E", animation: "walk_E" },
        ],
      },
    ]);
  });
});
