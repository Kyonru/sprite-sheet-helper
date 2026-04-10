import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";
import type { SnapshotEnabledStore } from "@/types/ecs";
import { createMergeKey } from "./history/utils";
import { withHistory } from "../common/middlewares/history";
import { isEqual } from "@/utils/object";

const DEFAULT_POSITION: [number, number, number] = [0, 0, 0];

export interface TargetsState {
  targets: Record<string, [number, number, number]>;
}

const initialState: TargetsState = {
  targets: {},
};

interface TargetsActions extends SnapshotEnabledStore<TargetsState> {
  setTarget: (uuid: string, target: [number, number, number]) => void;
  initTarget: (uuid: string, target?: [number, number, number]) => void;
  removeTarget: (uuid: string) => void;
}
export const useTargetsStore = create<TargetsState & TargetsActions>()(
  inspector(
    withHistory(
      (set, get) => ({
        ...initialState,

        initTarget: (uuid, target = DEFAULT_POSITION) =>
          set((state) => ({
            targets: { ...state.targets, [uuid]: target },
          })),

        setTarget: (uuid, target) =>
          set((state) => ({
            targets: { ...state.targets, [uuid]: target },
          })),

        removeTarget: (uuid) =>
          set((state) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [uuid]: _, ...rest } = state.targets;
            return { targets: rest };
          }),

        reset: () => set(initialState),

        hydrate: (snapshot) => set({ targets: snapshot.targets }),

        getSnapshot: () => ({ targets: get().targets }),
      }),
      {
        name: "Targets",
        watchers: [
          {
            select: (state) => state.targets,
            toAction: (prev, next, api) => {
              const prevKeys = new Set(Object.keys(prev.targets));
              const nextKeys = new Set(Object.keys(next.targets));

              // Init
              for (const uuid of nextKeys) {
                if (!prevKeys.has(uuid)) {
                  // Since target is init with their source, we don't need to init it here
                  return null;
                }
              }

              // Remove
              for (const uuid of prevKeys) {
                if (!nextKeys.has(uuid)) {
                  return {
                    type: "target/remove",
                    uuid,
                    from: prev.targets[uuid],
                    to: null,

                    apply: ({ dir, value }) => {
                      if (dir === "forward") {
                        api.getState().removeTarget(uuid);
                      } else {
                        api.getState().initTarget(uuid, value);
                      }
                    },
                  };
                }
              }

              // Move
              for (const uuid of nextKeys) {
                if (prev.targets[uuid] !== next.targets[uuid]) {
                  if (isEqual(prev.targets[uuid], next.targets[uuid]))
                    return null;
                  return {
                    type: "target/position",
                    uuid,
                    from: prev.targets[uuid],
                    to: next.targets[uuid],

                    apply: ({ value }) => {
                      api.getState().setTarget(uuid, value);
                    },
                  };
                }
              }

              return null;
            },
            mergeKey: (prev, next) => {
              for (const uuid of Object.keys(next.targets)) {
                if (prev.targets[uuid] !== next.targets[uuid]) {
                  return createMergeKey("target", uuid, "position");
                }
              }
              return undefined;
            },
          },
        ],
      },
    ),
    { name: "Targets" },
  ),
);

export const useTarget = (uuid?: string) =>
  useTargetsStore((state) => (uuid ? state.targets[uuid] : undefined));
