import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import {
  inspector,
  storeInspector,
} from "@kyonru/zustand-inspector";

type CounterState = {
  count: number;
  increment: (amount: number) => void;
};

const createCounter = (name: string, enabled = true) =>
  createStore<CounterState>()(
    inspector<CounterState>(
      (set) => ({
        count: 0,
        increment: (amount) =>
          set((state) => ({ count: state.count + amount }), false),
      }),
      { name, enabled },
    ),
  );

describe("@kyonru/zustand-inspector", () => {
  it("emits initial state and named action events", () => {
    const states: unknown[] = [];
    const actions: { action: string; payload: unknown }[] = [];
    const offState = storeInspector.on("state-changed", (event) => {
      if (event.payload.storeName === "CounterUnit") {
        states.push(event.payload.state);
      }
    });
    const offAction = storeInspector.on("action-dispatched", (event) => {
      if (event.payload.storeName === "CounterUnit") {
        actions.push({
          action: event.payload.action,
          payload: event.payload.payload,
        });
      }
    });

    const store = createCounter("CounterUnit");
    store.getState().increment(2);

    expect(states[0]).toMatchObject({ count: 0 });
    expect(states.at(-1)).toMatchObject({ count: 2 });
    expect(actions).toEqual([{ action: "increment", payload: 2 }]);

    offState();
    offAction();
  });

  it("uses explicit action objects passed to setState", () => {
    const actions: { action: string; payload: unknown }[] = [];
    const offAction = storeInspector.on("action-dispatched", (event) => {
      if (event.payload.storeName === "ExplicitCounter") {
        actions.push({
          action: event.payload.action,
          payload: event.payload.payload,
        });
      }
    });
    const store = createCounter("ExplicitCounter");

    store.setState({ count: 7 }, false, { type: "manual-set", value: 7 });

    expect(actions).toEqual([
      { action: "manual-set", payload: { type: "manual-set", value: 7 } },
    ]);

    offAction();
  });

  it("does not emit events when disabled", () => {
    let calls = 0;
    const offState = storeInspector.on("state-changed", (event) => {
      if (event.payload.storeName === "DisabledCounter") {
        calls++;
      }
    });

    const store = createCounter("DisabledCounter", false);
    store.getState().increment(1);

    expect(calls).toBe(0);

    offState();
  });

  it("removes listeners returned from on()", () => {
    let calls = 0;
    const offState = storeInspector.on("state-changed", (event) => {
      if (event.payload.storeName === "CleanupCounter") {
        calls++;
      }
    });
    offState();

    createCounter("CleanupCounter");

    expect(calls).toBe(0);
  });
});
