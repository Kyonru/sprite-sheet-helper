import { create } from "zustand";
import type { HistoryAction } from "@/types/history";
import { applyAction, reverseAction } from "./utils";

interface HistoryState {
  past: HistoryAction[];
  future: HistoryAction[];
}

interface HistoryActions {
  push: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

const MAX_HISTORY = 100;

export const useHistoryStore = create<HistoryState & HistoryActions>(
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
  }),
);
