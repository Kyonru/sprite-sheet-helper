import type { StateCreator, StoreApi, StoreMutatorIdentifier } from "zustand";
import { useHistoryStore } from "@/store/next/history";
import type { HistoryAction } from "@/types/history";

type HistoryMiddleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
  options: HistoryMiddlewareOptions<T>,
) => StateCreator<T, Mps, Mcs>;

export interface FieldWatcher<T> {
  // Which field in state to watch
  select: (state: T) => unknown;
  // Build a HistoryAction from prev/next values and the changed key
  toAction: (prev: T, next: T, api: StoreApi<T>) => HistoryAction | null;
  // Optional merge key for rapid changes
  mergeKey?: (prev: T, next: T, api: StoreApi<T>) => string | undefined;
}

export interface HistoryMiddlewareOptions<T> {
  name: string;
  watchers: FieldWatcher<T>[];
}

type HistoryMiddlewareImpl = <T>(
  f: StateCreator<T, [], []>,
  options: HistoryMiddlewareOptions<T>,
) => StateCreator<T, [], []>;

const historyMiddlewareImpl: HistoryMiddlewareImpl =
  (f, options) => (set, get, api) => {
    const trackedSet: typeof set = (partial, replace) => {
      const prev = get();

      // @ts-expect-error — zustand internals
      set(partial, replace);

      const next = get();

      // Skip if nothing changed
      if (prev === next) return;

      for (const watcher of options.watchers) {
        const prevVal = watcher.select(prev);
        const nextVal = watcher.select(next);

        if (prevVal === nextVal) continue;

        const action = watcher.toAction(prev, next, api);
        if (!action) continue;

        const mergeKey = watcher.mergeKey?.(prev, next, api);

        useHistoryStore.getState().push({
          ...action,
          mergeKey,
        });
      }
    };

    return f(trackedSet, get, api);
  };

export const withHistory = historyMiddlewareImpl as HistoryMiddleware;
