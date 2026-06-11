import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/store/next/history";
import type { HistoryAction, HistoryEntry, Vec3 } from "@/types/history";

const makeAction = (
  uuid: string,
  from: Vec3,
  to: Vec3,
  apply = vi.fn(),
  mergeKey?: string,
): HistoryEntry & { apply: ReturnType<typeof vi.fn> } => ({
  type: "target/position",
  uuid,
  from,
  to,
  apply,
  mergeKey,
});

describe("history store", () => {
  beforeEach(() => {
    useHistoryStore.getState().reset();
  });

  it("undoes and redoes an action with the right direction and value", () => {
    const action = makeAction("a", [0, 0, 0], [1, 2, 3]);
    useHistoryStore.getState().push(action);

    useHistoryStore.getState().undo();
    expect(action.apply).toHaveBeenLastCalledWith({
      dir: "backward",
      value: [0, 0, 0],
    });
    expect(useHistoryStore.getState().past).toHaveLength(0);
    expect(useHistoryStore.getState().future).toHaveLength(1);

    useHistoryStore.getState().redo();
    expect(action.apply).toHaveBeenLastCalledWith({
      dir: "forward",
      value: [1, 2, 3],
    });
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(useHistoryStore.getState().future).toHaveLength(0);
  });

  it("is a no-op to undo or redo with empty stacks", () => {
    useHistoryStore.getState().undo();
    useHistoryStore.getState().redo();

    expect(useHistoryStore.getState().past).toHaveLength(0);
    expect(useHistoryStore.getState().future).toHaveLength(0);
  });

  it("clears the redo stack when a new action is pushed", () => {
    useHistoryStore.getState().push(makeAction("a", [0, 0, 0], [1, 1, 1]));
    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().future).toHaveLength(1);

    useHistoryStore.getState().push(makeAction("b", [0, 0, 0], [2, 2, 2]));
    expect(useHistoryStore.getState().future).toHaveLength(0);
  });

  it("merges rapid actions sharing a merge key", () => {
    const now = vi.spyOn(Date, "now");

    now.mockReturnValue(1000);
    useHistoryStore
      .getState()
      .push(makeAction("a", [0, 0, 0], [1, 0, 0], vi.fn(), "target:a"));

    now.mockReturnValue(1100);
    useHistoryStore
      .getState()
      .push(makeAction("a", [1, 0, 0], [2, 0, 0], vi.fn(), "target:a"));

    const past = useHistoryStore.getState().past;
    expect(past).toHaveLength(1);
    // Merged entry spans from the first action's origin to the latest value.
    expect((past[0] as HistoryAction).from).toEqual([0, 0, 0]);
    expect((past[0] as HistoryAction).to).toEqual([2, 0, 0]);
  });

  it("does not merge actions outside the merge window", () => {
    const now = vi.spyOn(Date, "now");

    now.mockReturnValue(1000);
    useHistoryStore
      .getState()
      .push(makeAction("a", [0, 0, 0], [1, 0, 0], vi.fn(), "target:a"));

    now.mockReturnValue(2000);
    useHistoryStore
      .getState()
      .push(makeAction("a", [1, 0, 0], [2, 0, 0], vi.fn(), "target:a"));

    expect(useHistoryStore.getState().past).toHaveLength(2);
  });

  it("commits a transaction as a single batch and reverses it in order", () => {
    const calls: string[] = [];
    const first = makeAction(
      "a",
      [0, 0, 0],
      [1, 0, 0],
      vi.fn(() => calls.push("first")),
    );
    const second = makeAction(
      "b",
      [0, 0, 0],
      [2, 0, 0],
      vi.fn(() => calls.push("second")),
    );

    useHistoryStore.getState().beginTransaction("move both");
    useHistoryStore.getState().push(first);
    useHistoryStore.getState().push(second);

    // Nothing lands in past until commit.
    expect(useHistoryStore.getState().past).toHaveLength(0);

    useHistoryStore.getState().commitTransaction();
    const past = useHistoryStore.getState().past;
    expect(past).toHaveLength(1);
    expect(past[0].type).toBe("batch");

    useHistoryStore.getState().undo();
    // Batch reversal applies actions in reverse order.
    expect(calls).toEqual(["second", "first"]);
  });

  it("rolls back actions when a transaction is cancelled", () => {
    const apply = vi.fn();
    useHistoryStore.getState().beginTransaction("cancelled");
    useHistoryStore.getState().push(makeAction("a", [0, 0, 0], [1, 0, 0], apply));

    useHistoryStore.getState().cancelTransaction();

    expect(apply).toHaveBeenCalledWith({ dir: "backward", value: [0, 0, 0] });
    expect(useHistoryStore.getState().transaction).toBeNull();
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it("drops empty transactions on commit", () => {
    useHistoryStore.getState().beginTransaction("empty");
    useHistoryStore.getState().commitTransaction();

    expect(useHistoryStore.getState().transaction).toBeNull();
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it("ignores nested beginTransaction calls", () => {
    useHistoryStore.getState().beginTransaction("outer");
    useHistoryStore.getState().beginTransaction("inner");

    expect(useHistoryStore.getState().transaction?.label).toBe("outer");
    useHistoryStore.getState().cancelTransaction();
  });

  it("marks the project dirty when history changes", () => {
    useHistoryStore.getState().setDirty(false);
    useHistoryStore.getState().push(makeAction("a", [0, 0, 0], [1, 0, 0]));

    expect(useHistoryStore.getState().isDirty).toBe(true);
  });

  it("caps the undo stack at the history limit", () => {
    const now = vi.spyOn(Date, "now");

    for (let i = 0; i < 105; i++) {
      now.mockReturnValue(i * 1000);
      useHistoryStore.getState().push(makeAction("a", [0, 0, 0], [i, 0, 0]));
    }

    expect(useHistoryStore.getState().past.length).toBeLessThanOrEqual(101);
  });
});
