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
  const listeners = new Map<string, Set<Listener<InspectorEvent>>>();

  function emit<E extends InspectorEvent>(event: E) {
    (listeners.get(event.type) as Set<Listener<E>> | undefined)?.forEach((l) =>
      l(event),
    );
  }

  function on<K extends InspectorEvent["type"]>(
    type: K,
    listener: Listener<Extract<InspectorEvent, { type: K }>>,
  ) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    (listeners.get(type) as Set<
      Listener<Extract<InspectorEvent, { type: K }>>
    >)!.add(listener);
    return () =>
      (
        listeners.get(type) as Set<
          Listener<Extract<InspectorEvent, { type: K }>>
        >
      )?.delete(listener);
  }

  return { emit, on };
}

export const storeInspector = createInspectorClient();

export interface InspectorOptions {
  name: string;
  enabled?: boolean;
  anonymousActionType?: string;
}

type Action = string | { type: string; [k: string | number | symbol]: unknown };

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
  const frames = stack.split("\n").slice(1);
  const frame = frames.find(
    (f) => !INTERNAL_FRAMES.some((internal) => f.includes(internal)),
  );
  if (!frame) return undefined;
  return /^\s+at ([^\s(]+)/.exec(frame)?.[1];
}

// Tracks which store action function is currently executing. Set immediately
// before the action body runs, cleared in `finally` so it's always reset even
// if the action throws or never calls set() at all.

type CallContext = { fnName: string; args: unknown[] };

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

    let callContext: CallContext | null = null;

    api.setState = ((
      state: Parameters<StoreApi<T>["setState"]>[0],
      replace: Parameters<StoreApi<T>["setState"]>[1],
      nameOrAction?: Action,
    ) => {
      const result = set(state, replace);

      // Action name: explicit arg > wrapping function name > caller inference
      const action =
        nameOrAction !== undefined
          ? typeof nameOrAction === "string"
            ? nameOrAction
            : nameOrAction.type
          : (callContext?.fnName ??
            anonymousActionType ??
            findCallerName(new Error().stack) ??
            "anonymous");

      // Payload priority:
      //   1. explicit nameOrAction object  → use as-is
      //   2. callContext.args              → arguments passed to the action fn
      //      (unwrapped to scalar for single-arg: selectEntity(uuid) → uuid)
      //   3. state patch for plain object sets
      const payload =
        typeof nameOrAction === "object" && nameOrAction !== null
          ? nameOrAction
          : callContext !== null
            ? callContext.args.length === 1
              ? callContext.args[0]
              : callContext.args
            : typeof state === "object" && state !== null
              ? state
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

    (api as StoreApi<T> & { inspector: { cleanup: () => void } }).inspector = {
      cleanup: () => {},
    };

    const initialState = fn(api.setState, get, api);

    // Patch each function so it sets callContext before executing, giving
    // setState the fn name + args without any stack-parsing needed.
    for (const key of Object.keys(initialState as object)) {
      const val = (initialState as Record<string, unknown>)[key];
      if (typeof val !== "function") continue;

      (initialState as Record<string, unknown>)[key] = (...args: unknown[]) => {
        callContext = { fnName: key, args };
        try {
          return (val as (...a: unknown[]) => unknown)(...args);
        } finally {
          // Always clear — even if the action throws or calls set() async
          callContext = null;
        }
      };
    }

    storeInspector.emit({
      type: "state-changed",
      payload: { storeName: name, state: initialState },
    });

    return initialState;
  };

export const inspector = inspectorImpl as unknown as Inspector;
