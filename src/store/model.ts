import type { Object3D } from "three";
import { create } from "zustand";

interface ModelState {
  file: File | null;
  setFile: (file: File | null) => void;
  position: [number, number, number];
  setPosition: (position: [number, number, number]) => void;
  scale: number;
  setScale: (scale: number) => void;
  rotation: [number, number, number];
  setRotation: (rotation: [number, number, number]) => void;
  animation: string | null;
  setAnimation: (animation: string | null) => void;
  ref: Object3D | null;
  setRef: (ref: Object3D) => void;
}

export const useModelStore = create<ModelState>((set) => ({
  file: null,
  setFile: (file: File | null) => set(() => ({ file: file })),
  position: [0, 0, 0],
  setPosition: (position: [number, number, number]) =>
    set(() => ({ position: position })),
  scale: 1,
  setScale: (scale: number) => set(() => ({ scale: scale })),
  rotation: [0, 0, 0],
  setRotation: (rotation: [number, number, number]) =>
    set(() => ({ rotation: rotation })),
  animation: null,
  setAnimation: (animation: string | null) =>
    set(() => ({ animation: animation })),
  ref: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setRef: (ref: Object3D) => set(() => ({ ref: ref })),
}));
