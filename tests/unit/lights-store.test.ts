import { beforeEach, describe, expect, it } from "vitest";
import { LIGHT_DEFAULTS, useLightsStore } from "@/store/next/lights";
import { useHistoryStore } from "@/store/next/history";
import type { LightComponent } from "@/types/ecs";

describe("lights store", () => {
  beforeEach(() => {
    useLightsStore.getState().reset();
    useHistoryStore.getState().reset();
  });

  it("initializes each light type with its defaults", () => {
    for (const type of Object.keys(LIGHT_DEFAULTS)) {
      useLightsStore.getState().initLight(type, type as LightComponent["type"]);
      expect(useLightsStore.getState().lights[type]).toEqual(
        LIGHT_DEFAULTS[type],
      );
    }
  });

  it("applies overrides on init and merges partial edits", () => {
    useLightsStore.getState().initLight("a", "spot", { intensity: 3 });
    expect(useLightsStore.getState().lights["a"]).toMatchObject({
      type: "spot",
      intensity: 3,
      color: "#ffffff",
    });

    useLightsStore.getState().setLight("a", { color: "#ff0000" });
    expect(useLightsStore.getState().lights["a"]).toMatchObject({
      intensity: 3,
      color: "#ff0000",
    });
  });

  it("removes lights", () => {
    useLightsStore.getState().initLight("a", "point");
    useLightsStore.getState().removeLight("a");
    expect(useLightsStore.getState().lights["a"]).toBeUndefined();
  });

  it("round-trips state through snapshot and hydrate", () => {
    useLightsStore.getState().initLight("a", "directional", { intensity: 2 });

    const snapshot = useLightsStore.getState().getSnapshot();
    useLightsStore.getState().reset();
    useLightsStore.getState().hydrate(snapshot);

    expect(useLightsStore.getState().lights["a"]).toMatchObject({
      type: "directional",
      intensity: 2,
    });
  });
});
