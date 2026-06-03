import { beforeEach, describe, expect, it } from "vitest";
import { useEffectsStore, type EffectsState } from "@/store/next/effects";
import type { EffectComponent } from "@/types/effects";

const pixelation: EffectComponent = {
  type: "pixelation",
  enabled: true,
  granularity: 2,
};

const bloom: EffectComponent = {
  type: "bloom",
  enabled: true,
  blendFunction: 9,
  luminanceThreshold: 1,
  luminanceSmoothing: 0.03,
  intensity: 1,
  mipmapBlur: true,
  levels: 8,
  radius: 0.85,
};

describe("effects store stack", () => {
  beforeEach(() => {
    useEffectsStore.getState().reset();
  });

  it("backfills order when hydrating old snapshots", () => {
    useEffectsStore.getState().hydrate({
      effects: {
        first: pixelation,
        second: bloom,
      },
      selected: "second",
    } as EffectsState);

    expect(useEffectsStore.getState().order).toEqual(["first", "second"]);
    expect(useEffectsStore.getState().selected).toBe("second");
  });

  it("adds, reorders, duplicates, and removes effects with valid order", () => {
    const store = useEffectsStore.getState();
    const first = store.initEffect("pixelation");
    const second = store.initEffect("bloom");

    expect(useEffectsStore.getState().order).toEqual([first, second]);

    useEffectsStore.getState().reorderEffects([second, first]);
    expect(useEffectsStore.getState().order).toEqual([second, first]);

    useEffectsStore.getState().duplicateEffect(first);
    const afterDuplicate = useEffectsStore.getState();
    expect(afterDuplicate.order).toHaveLength(3);
    expect(afterDuplicate.order[2]).not.toBe(first);
    expect(afterDuplicate.effects[afterDuplicate.order[2]].type).toBe(
      "pixelation",
    );

    useEffectsStore.getState().removeEffect(second);
    expect(useEffectsStore.getState().order).not.toContain(second);
    expect(useEffectsStore.getState().effects[second]).toBeUndefined();
  });

  it("applies presets as normal stack entries", () => {
    useEffectsStore.getState().applyEffectsPreset("pixel-art", "append");

    const state = useEffectsStore.getState();
    expect(state.order).toHaveLength(4);
    expect(state.order.map((uuid) => state.effects[uuid].type)).toEqual([
      "pixelation",
      "colorDepth",
      "dither",
      "gammaCorrection",
    ]);
  });

  it("replaces existing stack with a preset", () => {
    useEffectsStore.getState().initEffect("bloom");
    useEffectsStore.getState().applyEffectsPreset("depth-debug", "replace");

    const state = useEffectsStore.getState();
    expect(state.order.map((uuid) => state.effects[uuid].type)).toEqual([
      "depth",
      "outline",
    ]);
  });

  it("clears the stack", () => {
    useEffectsStore.getState().initEffect("pixelation");
    useEffectsStore.getState().clearEffects();

    expect(useEffectsStore.getState().getSnapshot()).toEqual({
      effects: {},
      order: [],
      selected: undefined,
    });
  });
});
