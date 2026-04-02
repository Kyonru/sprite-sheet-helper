import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";
import * as THREE from "three";

type RefType = "model";

interface RefsState {
  refs: Record<
    string,
    {
      current: THREE.Object3D;
      type: RefType;
    }
  >;
}

interface RefsActions {
  setRef: (uuid: string, ref: THREE.Object3D, type: RefType) => void;
  removeRef: (uuid: string) => void;
}

interface RefsStore extends RefsState, RefsActions {}

export const useRefsStore = create<RefsStore>()(
  inspector(
    (set) => ({
      refs: {},

      setRef: (uuid, ref, type) =>
        set((state) => ({
          refs: {
            ...state.refs,
            [uuid]: {
              current: ref,
              type,
            },
          },
        })),
      removeRef: (uuid) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...rest } = state.refs;

          return { refs: { ...rest } };
        }),
    }),
    {
      name: "Refs",
    },
  ),
);

export const useObjectRef = (uuid?: string) =>
  useRefsStore((state) => (uuid ? state.refs[uuid] : undefined));
