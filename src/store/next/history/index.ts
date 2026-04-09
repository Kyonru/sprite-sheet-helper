import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { inspector } from "../../../../devtools/inspector-middleware";
import type {
  HistoryAction,
  HistoryEntry,
  HistoryTransaction,
} from "@/types/history";
import { applyAction, reverseAction } from "./utils";
import type { SnapshotEnabledStore } from "@/types/ecs";

export interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
  transaction: HistoryTransaction | null;
  isDirty: boolean;
}

interface HistoryActions extends SnapshotEnabledStore<HistoryState> {
  push: (action: HistoryEntry) => void;
  pushBatch: (label: string, actions: HistoryAction[]) => void;
  beginTransaction: (label: string, mergeKey?: string) => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  setDirty: (dirty: boolean) => void;
}

const initialState: HistoryState = {
  transaction: null,
  past: [],
  future: [],
  isDirty: false,
};

const MAX_HISTORY = 100;
const MERGE_WINDOW = 1000;

function canMerge(a?: HistoryEntry, b?: HistoryEntry, now?: number) {
  if (!a || !b) return false;
  if (!a.mergeKey || !b.mergeKey) return false;
  if (a.mergeKey !== b.mergeKey) return false;
  if (!a.timestamp || !now) return false;

  return now - a.timestamp < MERGE_WINDOW;
}

function mergeEntries(prev: HistoryEntry, next: HistoryEntry): HistoryEntry {
  if (prev.type === "batch" && next.type === "batch") {
    return {
      ...prev,
      actions: [...prev.actions, ...next.actions],
      timestamp: next.timestamp,
    };
  }

  if (prev.type !== "batch" && next.type !== "batch") {
    return {
      ...prev,
      ...next,

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      from: prev.from as any,
      timestamp: next.timestamp,
    };
  }

  const prevActions = prev.type === "batch" ? prev.actions : [prev];

  const nextActions = next.type === "batch" ? next.actions : [next];

  return {
    type: "batch",
    actions: [...prevActions, ...nextActions],
    mergeKey: next.mergeKey ?? prev.mergeKey,
    timestamp: next.timestamp,
  };
}

const commitEntry = (
  state: HistoryState,
  entry: HistoryEntry,
): HistoryState => {
  const now = entry.timestamp ?? Date.now();
  const next = { ...entry, timestamp: now };

  const last = state.past[state.past.length - 1];

  if (canMerge(last, next, now)) {
    const merged = mergeEntries(last!, next);

    return {
      ...state,
      past: [...state.past.slice(0, -1), merged],
      future: [],
    };
  }

  return {
    ...state,
    past: [...state.past.slice(-MAX_HISTORY), next],
    future: [],
  };
};

export const useHistoryStore = create<HistoryState & HistoryActions>()(
  inspector(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      push: (entry) =>
        set((state) => {
          const now = Date.now();

          const next: HistoryEntry = {
            ...entry,
            timestamp: now,
          };

          if (state.transaction) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { timestamp, mergeKey, ...action } = next;
            state.transaction.actions.push(action as HistoryAction);

            return { transaction: { ...state.transaction } };
          }

          return commitEntry(state, next);
        }),

      pushBatch: (
        label: string,
        actions: HistoryAction[],
        options?: { mergeKey?: string },
      ) => {
        get().push({
          type: "batch",
          label,
          actions,
          mergeKey: options?.mergeKey,
        });
      },

      undo: () => {
        const { past, future } = get();
        if (past.length === 0) return;

        const action = past[past.length - 1];
        reverseAction(action);

        set({
          past: past.slice(0, -1),
          future: [action, ...future],
        });
      },

      redo: () => {
        const { past, future } = get();
        if (future.length === 0) return;

        const action = future[0];
        applyAction(action);

        set({
          past: [...past, action],
          future: future.slice(1),
        });
      },

      clear: () => set({ past: [], future: [] }),

      beginTransaction: (label, mergeKey) => {
        if (get().transaction) return;

        set(() => ({
          transaction: {
            label,
            mergeKey,
            actions: [],
          },
        }));
      },

      commitTransaction: () => {
        set((state) => {
          const tx = state.transaction;

          if (!tx || tx.actions.length === 0) {
            return { transaction: null };
          }

          const entry: HistoryEntry = {
            type: "batch",
            label: tx.label,
            actions: tx.actions,
            mergeKey: tx.mergeKey,
            timestamp: Date.now(),
          };

          const nextState = commitEntry({ ...state, transaction: null }, entry);

          return {
            ...nextState,
            transaction: null,
          };
        });
      },

      cancelTransaction: () => {
        const { transaction } = get();
        if (!transaction) return;

        // rollback everything
        for (let i = transaction.actions.length - 1; i >= 0; i--) {
          reverseAction(transaction.actions[i]);
        }

        set({ transaction: null });
      },

      reset: () => set(initialState),

      getSnapshot: () => {
        return {
          isDirty: get().isDirty,
          transaction: get().transaction,
          past: get().past,
          future: get().future,
        };
      },

      setDirty: (dirty: boolean) => set({ isDirty: dirty }),

      hydrate: (snapshot) =>
        set({
          past: snapshot.past,
          future: snapshot.future,
        }),
    })),
    { name: "History" },
  ),
);

useHistoryStore.subscribe(
  (state) => state.future,
  () => {
    useHistoryStore.getState().setDirty(true);
  },
);

useHistoryStore.subscribe(
  (state) => state.past,
  () => {
    useHistoryStore.getState().setDirty(true);
  },
);

useHistoryStore.subscribe(
  (state) => state.transaction,
  () => {
    useHistoryStore.getState().setDirty(true);
  },
);
