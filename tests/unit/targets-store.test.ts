import { beforeEach, describe, expect, it } from "vitest";
import { useTargetsStore } from "@/store/next/targets";
import { useHistoryStore } from "@/store/next/history";

describe("targets store", () => {
  beforeEach(() => {
    useTargetsStore.getState().reset();
    useHistoryStore.getState().reset();
  });

  it("initializes targets at the origin by default", () => {
    useTargetsStore.getState().initTarget("a");
    expect(useTargetsStore.getState().targets["a"]).toEqual([0, 0, 0]);

    useTargetsStore.getState().initTarget("b", [1, 2, 3]);
    expect(useTargetsStore.getState().targets["b"]).toEqual([1, 2, 3]);
  });

  it("undoes a target move through the history store", () => {
    useTargetsStore.getState().initTarget("a");
    useHistoryStore.getState().reset();

    useTargetsStore.getState().setTarget("a", [4, 5, 6]);
    expect(useTargetsStore.getState().targets["a"]).toEqual([4, 5, 6]);

    useHistoryStore.getState().undo();
    expect(useTargetsStore.getState().targets["a"]).toEqual([0, 0, 0]);
  });

  it("restores a removed target on undo", () => {
    useTargetsStore.getState().initTarget("a", [7, 8, 9]);
    useHistoryStore.getState().reset();

    useTargetsStore.getState().removeTarget("a");
    expect(useTargetsStore.getState().targets["a"]).toBeUndefined();

    useHistoryStore.getState().undo();
    expect(useTargetsStore.getState().targets["a"]).toEqual([7, 8, 9]);
  });

  it("round-trips state through snapshot and hydrate", () => {
    useTargetsStore.getState().initTarget("a", [1, 1, 1]);

    const snapshot = useTargetsStore.getState().getSnapshot();
    useTargetsStore.getState().reset();
    useTargetsStore.getState().hydrate(snapshot);

    expect(useTargetsStore.getState().targets["a"]).toEqual([1, 1, 1]);
  });
});
