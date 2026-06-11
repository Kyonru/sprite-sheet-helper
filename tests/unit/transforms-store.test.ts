import { beforeEach, describe, expect, it } from "vitest";
import { useTransformsStore } from "@/store/next/transforms";
import { useHistoryStore } from "@/store/next/history";

describe("transforms store", () => {
  beforeEach(() => {
    useTransformsStore.getState().reset();
    useHistoryStore.getState().reset();
  });

  it("initializes with defaults and accepts overrides", () => {
    useTransformsStore.getState().initTransform("a");
    expect(useTransformsStore.getState().transforms["a"]).toEqual({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    useTransformsStore.getState().initTransform("b", { position: [1, 2, 3] });
    expect(useTransformsStore.getState().transforms["b"].position).toEqual([
      1, 2, 3,
    ]);
    expect(useTransformsStore.getState().transforms["b"].scale).toEqual([
      1, 1, 1,
    ]);
  });

  it("merges partial updates into existing transforms", () => {
    useTransformsStore.getState().initTransform("a");
    useTransformsStore.getState().setTransform("a", { rotation: [0, 90, 0] });

    const transform = useTransformsStore.getState().transforms["a"];
    expect(transform.rotation).toEqual([0, 90, 0]);
    expect(transform.position).toEqual([0, 0, 0]);
  });

  it("removes transforms and switches gizmo mode", () => {
    useTransformsStore.getState().initTransform("a");
    useTransformsStore.getState().removeTransform("a");
    expect(useTransformsStore.getState().transforms["a"]).toBeUndefined();

    useTransformsStore.getState().setMode("rotate");
    expect(useTransformsStore.getState().mode).toBe("rotate");
  });

  it("undoes a transform edit through the history store", () => {
    useTransformsStore.getState().initTransform("a");
    useHistoryStore.getState().reset();

    useTransformsStore.getState().setTransform("a", { position: [5, 0, 0] });
    expect(useTransformsStore.getState().transforms["a"].position).toEqual([
      5, 0, 0,
    ]);

    useHistoryStore.getState().undo();
    expect(useTransformsStore.getState().transforms["a"].position).toEqual([
      0, 0, 0,
    ]);
  });

  it("merges rapid edits of the same transform into one undo step", () => {
    useTransformsStore.getState().initTransform("a");
    useHistoryStore.getState().reset();

    useTransformsStore.getState().setTransform("a", { position: [1, 0, 0] });
    useTransformsStore.getState().setTransform("a", { position: [2, 0, 0] });

    expect(useHistoryStore.getState().past).toHaveLength(1);

    useHistoryStore.getState().undo();
    expect(useTransformsStore.getState().transforms["a"].position).toEqual([
      0, 0, 0,
    ]);
  });

  it("round-trips state through snapshot and hydrate", () => {
    useTransformsStore.getState().initTransform("a", { scale: [2, 2, 2] });
    useTransformsStore.getState().setMode("scale");

    const snapshot = useTransformsStore.getState().getSnapshot();
    useTransformsStore.getState().reset();
    useTransformsStore.getState().hydrate(snapshot);

    expect(useTransformsStore.getState().transforms["a"].scale).toEqual([
      2, 2, 2,
    ]);
    expect(useTransformsStore.getState().mode).toBe("scale");
  });
});
