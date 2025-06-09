import type { Object3D } from "three";
import { create } from "zustand";
import { UpdatableUIStateDefault, type UpdatableUIState } from "./common/ui";
import { TransformStateDefault, type TransformState } from "./common/transform";

interface ModelState extends UpdatableUIState, TransformState {
  file: File | null;
  setFile: (file: File | null) => void;
  animation: string | null;
  setAnimation: (animation: string | null) => void;
  ref: Object3D | null;
  setRef: (ref: Object3D) => void;
}

export const useModelStore = create<ModelState>((set) => ({
  ...UpdatableUIStateDefault(set),
  ...TransformStateDefault(set),
  file: null,
  setFile: (file: File | null) => set(() => ({ file: file })),
  animation: null,
  setAnimation: (animation: string | null) =>
    set(() => ({ animation: animation })),
  ref: null,
  setRef: (ref: Object3D) => set(() => ({ ref: ref })),
}));
