import { describe, expect, it } from "vitest";
import { computePosition, WORKFLOW_PRESETS } from "@/constants/workflows";
import { buildWorkflowSteps, type WorkflowClipEntry } from "@/utils/workflows";

const workflow = WORKFLOW_PRESETS.find((preset) => preset.id === "topdown-4dir")!;

const clip = (name: string): WorkflowClipEntry => ({ clip: { name } });

describe("workflow utilities", () => {
  it("computes camera positions from spherical workflow angles", () => {
    const position = computePosition(90, 90, 2, [1, 2, 3]);

    expect(position[0]).toBeCloseTo(3);
    expect(position[1]).toBeCloseTo(2);
    expect(position[2]).toBeCloseTo(3);
  });

  it("builds none_* steps when no animation clips exist", () => {
    const steps = buildWorkflowSteps(workflow, { clips: {}, modelUuids: [] });

    expect(steps.map((step) => step.rowLabel)).toEqual([
      "none_N",
      "none_E",
      "none_S",
      "none_W",
    ]);
  });

  it("deduplicates animation names per model", () => {
    const steps = buildWorkflowSteps(workflow, {
      clips: { modelA: [clip("walk"), clip("walk"), clip("idle")] },
      modelUuids: ["modelA"],
    });

    expect(steps).toHaveLength(8);
    expect(steps.map((step) => step.rowLabel)).toContain("walk_N");
    expect(steps.map((step) => step.rowLabel)).toContain("idle_W");
  });

  it("filters hidden animation names from workflow steps", () => {
    const steps = buildWorkflowSteps(workflow, {
      clips: { modelA: [clip("walk"), clip("idle")] },
      hiddenAnimations: { modelA: ["idle"] },
      modelUuids: ["modelA"],
    });

    expect(steps).toHaveLength(4);
    expect(steps.map((step) => step.rowLabel)).toEqual([
      "walk_N",
      "walk_E",
      "walk_S",
      "walk_W",
    ]);
  });

  it("prefixes row labels when multiple models can collide", () => {
    const steps = buildWorkflowSteps(workflow, {
      clips: {
        "model-a-uuid": [clip("walk")],
        "model-b-uuid": [clip("walk")],
      },
      modelUuids: ["model-a-uuid", "model-b-uuid"],
    });

    expect(steps.map((step) => step.rowLabel)).toContain("model-a-_walk_N");
    expect(steps.map((step) => step.rowLabel)).toContain("model-b-_walk_N");
  });
});
