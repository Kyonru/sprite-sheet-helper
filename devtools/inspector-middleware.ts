/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  StateCreator,
  StoreApi,
  StoreMutatorIdentifier,
} from "zustand/vanilla";

type InspectorEvent =
  | { type: "state-changed"; payload: { storeName: string; state: unknown } }
  | {
      type: "action-dispatched";
      payload: {
        storeName: string;
        action: string;
        payload: unknown;
        timestamp: number;
      };
    };

type Listener<E extends InspectorEvent> = (event: E) => void;

function createInspectorClient() {
  const listeners = new Map<string, Set<Listener<any>>>();

  function emit<E extends InspectorEvent>(event: E) {
    listeners.get(event.type)?.forEach((l) => l(event));
  }

  function on<T extends InspectorEvent["type"]>(
    type: T,
    listener: Listener<Extract<InspectorEvent, { type: T }>>,
  ) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(listener as Listener<any>);
    return () => listeners.get(type)?.delete(listener as Listener<any>);
  }

  return { emit, on };
}

export const storeInspector = createInspectorClient();

export interface InspectorOptions {
  /** Display name shown in the inspector panel */
  name: string;
  /** Disable in production (defaults to true in non-production) */
  enabled?: boolean;
  /**
   * Action type used when setState is called without an explicit name.
   * Falls back to caller inference → "anonymous".
   */
  anonymousActionType?: string;
}

type Action = string | { type: string; [k: string | number | symbol]: unknown };

// Mirrors the TakeTwo helper from the devtools source — extracts the first two
// args of a tuple regardless of its total length, so we can append `action?`
// as a third parameter without breaking either setState overload.
type TakeTwo<T> = T extends { length: 0 }
  ? [undefined, undefined]
  : T extends { length: 1 }
    ? [...args0: Cast<T, unknown[]>, arg1: undefined]
    : T extends { length: 0 | 1 }
      ? [...args0: Cast<T, unknown[]>, arg1: undefined]
      : T extends { length: 2 }
        ? T
        : T extends { length: 1 | 2 }
          ? T
          : T extends { length: 0 | 1 | 2 }
            ? T
            : T extends [infer A0, infer A1, ...unknown[]]
              ? [A0, A1]
              : T extends [infer A0, (infer A1)?, ...unknown[]]
                ? [A0, A1?]
                : T extends [(infer A0)?, (infer A1)?, ...unknown[]]
                  ? [A0?, A1?]
                  : never;

type Cast<T, U> = T extends U ? T : U;
type Write<T, U> = Omit<T, keyof U> & U;

// Rewrites setState on the store type to accept an optional `action` third arg,
// matching the same pattern devtools uses for its NamedSet export.
type StoreInspector<S> = S extends {
  setState: {
    (...args: infer Sa1): infer Sr1;
    (...args: infer Sa2): infer Sr2;
  };
}
  ? {
      setState(...args: [...args: TakeTwo<Sa1>, action?: Action]): Sr1;
      setState(...args: [...args: TakeTwo<Sa2>, action?: Action]): Sr2;
      inspector: { cleanup: () => void };
    }
  : never;

type WithInspector<S> = Write<S, StoreInspector<S>>;

declare module "zustand/vanilla" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface StoreMutators<S, A> {
    "zustand/inspector": WithInspector<S>;
  }
}

export type NamedSet<T> = WithInspector<StoreApi<T>>["setState"];

type Inspector = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
  U = T,
>(
  initializer: StateCreator<T, [...Mps, ["zustand/inspector", never]], Mcs, U>,
  options: InspectorOptions,
) => StateCreator<T, Mps, [["zustand/inspector", never], ...Mcs]>;

const INTERNAL_FRAMES = ["inspector-middleware", "zustand", "node_modules"];

function findCallerName(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const frames = stack.split("\n").slice(1); // drop "Error"
  const frame = frames.find(
    (f) => !INTERNAL_FRAMES.some((internal) => f.includes(internal)),
  );
  if (!frame) return undefined;
  // "  at functionName (file:line:col)"        → "functionName"
  // "  at Object.methodName (file:line:col)"   → "Object.methodName"
  return /^\s+at ([^\s(]+)/.exec(frame)?.[1];
}

const inspectorImpl =
  <T>(
    fn: StateCreator<T, [], []>,
    options: InspectorOptions,
  ): StateCreator<T, [], []> =>
  (set, get, api) => {
    const {
      name,
      enabled = typeof process !== "undefined"
        ? process.env.NODE_ENV !== "production"
        : true,
      anonymousActionType,
    } = options;

    if (!enabled) return fn(set, get, api);

    api.setState = ((
      state: Parameters<StoreApi<T>["setState"]>[0],
      replace: Parameters<StoreApi<T>["setState"]>[1],
      nameOrAction?: Action,
    ) => {
      const result = set(state, replace as any);

      const action =
        nameOrAction === undefined
          ? (anonymousActionType ??
            findCallerName(new Error().stack) ??
            "anonymous")
          : typeof nameOrAction === "string"
            ? nameOrAction
            : nameOrAction.type;

      const payload =
        typeof nameOrAction === "object" && nameOrAction !== null
          ? nameOrAction
          : {};

      storeInspector.emit({
        type: "action-dispatched",
        payload: { storeName: name, action, payload, timestamp: Date.now() },
      });

      storeInspector.emit({
        type: "state-changed",
        payload: { storeName: name, state: get() },
      });

      return result;
    }) as NamedSet<T>;

    (api as any).inspector = {
      cleanup: () => {
        // Nothing to teardown for the in-process bus,
        // but hooks into external transports (e.g. WebSocket) would go here.
      },
    };

    const initialState = fn(api.setState, get, api);

    storeInspector.emit({
      type: "state-changed",
      payload: { storeName: name, state: initialState },
    });

    return initialState;
  };

export const inspector = inspectorImpl as unknown as Inspector;
