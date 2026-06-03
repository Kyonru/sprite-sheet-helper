import { describe, expect, it } from "vitest";
import type { EffectComponent } from "@/types/effects";
import {
  getEffectGuidance,
  getOrderedEffects,
  normalizeEffectOrder,
} from "@/utils/effects";

const pixelation: EffectComponent = {
  type: "pixelation",
  enabled: true,
  granularity: 2,
};

const glitch: EffectComponent = {
  type: "glitch",
  enabled: true,
  delay: [0, 0],
  duration: [0.1, 0.1],
  strength: [0.3, 0.3],
  chromaticAberrationOffset: [0, 0],
  dtSize: 64,
  columns: 0.05,
  mode: 0,
  ratio: 0.85,
};

const ssao: EffectComponent = {
  type: "ssao",
  enabled: true,
  blendFunction: 1,
  depthAwareUpsampling: true,
  samples: 9,
  rings: 7,
  worldDistanceThreshold: 0.01,
  worldDistanceFalloff: 0,
  worldProximityThreshold: 0.01,
  worldProximityFalloff: 0,
  minRadiusScale: 0.1,
  luminanceInfluence: 0.7,
  radius: 0.18,
  intensity: 1,
  bias: 0.025,
  fade: 0.01,
  color: "#ffffff",
  resolutionScale: 1,
  resolutionX: 0,
  resolutionY: 0,
};

describe("effect helpers", () => {
  it("normalizes stale or missing effect order", () => {
    const effects = { a: pixelation, b: glitch };

    expect(normalizeEffectOrder(effects, ["missing", "b"])).toEqual([
      "b",
      "a",
    ]);
  });

  it("returns ordered effects for composer rendering", () => {
    const effects = { a: pixelation, b: glitch };

    expect(getOrderedEffects(effects, ["b", "a"]).map((entry) => entry.uuid))
      .toEqual(["b", "a"]);
  });

  it("reports normal-map, reproducibility, and performance guidance", () => {
    const guidance = getEffectGuidance(
      { a: pixelation, b: glitch, c: ssao },
      ["a", "b", "c"],
    );

    expect(guidance.map((item) => item.kind)).toEqual([
      "normal-map",
      "reproducibility",
      "performance",
    ]);
  });

  it("ignores disabled effects when reporting warnings", () => {
    const guidance = getEffectGuidance({
      a: { ...glitch, enabled: false },
    });

    expect(guidance.map((item) => item.kind)).toEqual(["normal-map"]);
  });
});
