import { create } from "zustand";
import { inspector } from "../../../../devtools/inspector-middleware";
import type { HistoryAction } from "@/types/history";
import { applyAction, reverseAction } from "./utils";
import type { SnapshotEnabledStore } from "@/types/ecs";

export interface HistoryState {
  past: HistoryAction[];
  future: HistoryAction[];
}

interface HistoryActions extends SnapshotEnabledStore<HistoryState> {
  push: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

const MAX_HISTORY = 100;

export const useHistoryStore = create<HistoryState & HistoryActions>()(
  inspector(
    (set, get) => ({
      past: [],
      future: [],

      push: (action) =>
        set((state) => ({
          past: [...state.past.slice(-MAX_HISTORY), action],
          future: [],
        })),

      undo: () => {
        const { past, future } = get();
        if (past.length === 0) return;

        const action = past[past.length - 1];
        reverseAction(action); // apply the "from" values back to stores

        set({
          past: past.slice(0, -1),
          future: [action, ...future],
        });
      },

      redo: () => {
        const { past, future } = get();
        if (future.length === 0) return;

        const action = future[0];
        applyAction(action); // apply the "to" values to stores

        set({
          past: [...past, action],
          future: future.slice(1),
        });
      },

      clear: () => set({ past: [], future: [] }),

      getSnapshot: () => {
        return {
          past: get().past,
          future: get().future,
        };
      },

      hydrate: (snapshot) =>
        set({
          past: snapshot.past,
          future: snapshot.future,
        }),
    }),
    { name: "History" },
  ),
);
