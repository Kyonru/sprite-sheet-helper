import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";

const DEFAULT_POSITION: [number, number, number] = [0, 0, 0];

interface TargetsState {
  targets: Record<string, [number, number, number]>;
}

interface TargetsActions {
  setTarget: (uuid: string, target: [number, number, number]) => void;
  initTarget: (uuid: string, target?: [number, number, number]) => void;
  removeTarget: (uuid: string) => void;
  hydrate: (targets: Record<string, [number, number, number]>) => void;
}

export const useTargetsStore = create<TargetsState & TargetsActions>()(
  inspector(
    (set) => ({
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

      hydrate: (targets) => set({ targets }),
    }),
    {
      name: "Targets",
    },
  ),
);

export const useTarget = (uuid?: string) =>
  useTargetsStore((state) => (uuid ? state.targets[uuid] : undefined));
