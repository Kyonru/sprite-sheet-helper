import { describe, expect, it } from "vitest";
import { getActiveAnimationSequenceLabel } from "@/utils/animation-sequence-label";

const clip = (name: string) => ({ clip: { name } });

describe("getActiveAnimationSequenceLabel", () => {
  it("uses the selected model animation when it is active", () => {
    expect(
      getActiveAnimationSequenceLabel({
        selectedUuid: "model-a",
        animations: {
          "model-a": "Walk",
          "model-b": "Idle",
        },
        clips: {
          "model-a": [clip("Walk")],
          "model-b": [clip("Idle")],
        },
      }),
    ).toBe("Walk");
  });

  it("falls back to the active animation when no selected model has one", () => {
    expect(
      getActiveAnimationSequenceLabel({
        selectedUuid: "camera-a",
        animations: {
          "model-a": "Run",
        },
        clips: {
          "model-a": [clip("Run")],
        },
      }),
    ).toBe("Run");
  });

  it("joins multiple active animation names without duplicates", () => {
    expect(
      getActiveAnimationSequenceLabel({
        animations: {
          "model-a": "Walk",
          "model-b": "Walk",
          "model-c": "Jump",
        },
        clips: {
          "model-a": [clip("Walk")],
          "model-b": [clip("Walk")],
          "model-c": [clip("Jump")],
        },
      }),
    ).toBe("Walk_Jump");
  });

  it("ignores empty, none, and missing clip animations", () => {
    expect(
      getActiveAnimationSequenceLabel({
        animations: {
          "model-a": "none",
          "model-b": "",
          "model-c": "Missing",
        },
        clips: {
          "model-a": [clip("Walk")],
          "model-b": [clip("Idle")],
          "model-c": [clip("Idle")],
        },
      }),
    ).toBeUndefined();
  });
});
