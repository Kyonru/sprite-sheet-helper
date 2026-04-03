import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";
import type { SnapshotEnabledStore } from "@/types/ecs";

const DEFAULT_POSITION: [number, number, number] = [0, 0, 0];

export interface TargetsState {
  targets: Record<string, [number, number, number]>;
}

interface TargetsActions extends SnapshotEnabledStore<TargetsState> {
  setTarget: (uuid: string, target: [number, number, number]) => void;
  initTarget: (uuid: string, target?: [number, number, number]) => void;
  removeTarget: (uuid: string) => void;
}

export const useTargetsStore = create<TargetsState & TargetsActions>()(
  inspector(
    (set, get) => ({
      targets: {},

      initTarget: (uuid, target = DEFAULT_POSITION) =>
        set((state) => ({
          targets: {
            ...state.targets,
            [uuid]: target,
          },
        })),

      setTarget: (uuid, target) =>
        set((state) => ({
          targets: {
            ...state.targets,
            [uuid]: target,
          },
        })),

      removeTarget: (uuid) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...rest } = state.targets;
          return { targets: rest };
        }),

      hydrate: (snapshot) =>
        set({
          targets: snapshot.targets,
        }),

      getSnapshot: () => {
        return {
          targets: get().targets,
        };
      },
    }),
    {
      name: "Targets",
    },
  ),
);

export const useTarget = (uuid?: string) =>
  useTargetsStore((state) => (uuid ? state.targets[uuid] : undefined));
