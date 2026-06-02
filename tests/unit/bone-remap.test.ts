import { describe, expect, it } from "vitest";
import {
  MIXAMO_DEFAULT_REMAP,
  autoDetectRemap,
  type BoneRemap,
} from "@/utils/bone-remap";

describe("autoDetectRemap", () => {
  it("detects common Mixamo-style bone names", () => {
    const remap = autoDetectRemap([
      "mixamorigHips",
      "mixamorigSpine",
      "mixamorigSpine1",
      "mixamorigSpine2",
      "mixamorigNeck",
      "mixamorigHead",
      "mixamorigLeftArm",
      "mixamorigRightArm",
      "mixamorigLeftForeArm",
      "mixamorigRightForeArm",
      "mixamorigLeftUpLeg",
      "mixamorigRightUpLeg",
      "mixamorigLeftLeg",
      "mixamorigRightLeg",
      "mixamorigLeftFoot",
      "mixamorigRightFoot",
    ]);

    expect(remap.leftArm).toBe("mixamorigLeftArm");
    expect(remap.rightForeArm).toBe("mixamorigRightForeArm");
    expect(remap.leftUpLeg).toBe("mixamorigLeftUpLeg");
    expect(remap.head).toBe("mixamorigHead");
  });

  it("preserves manual remap values when callers merge detected values", () => {
    const manual: BoneRemap = {
      ...MIXAMO_DEFAULT_REMAP,
      head: "CustomHead",
    };
    const detected = autoDetectRemap(["CharacterHips", "CharacterSpine"]);
    const merged = { ...detected, head: manual.head };

    expect(merged.hips).toBe("CharacterHips");
    expect(merged.spine).toBe("CharacterSpine");
    expect(merged.head).toBe("CustomHead");
  });
});
