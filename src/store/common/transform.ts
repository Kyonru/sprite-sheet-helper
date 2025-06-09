/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Transform } from "@/types/transform";

export interface TransformState {
  transform: Transform;
  setTransform: (transform: Transform) => void;
  position: [number, number, number];
  setPosition: (position: [number, number, number]) => void;
  scale: [number, number, number];
  setScale: (scale: [number, number, number]) => void;
  rotation: [number, number, number];
  setRotation: (rotation: [number, number, number]) => void;
}

export const TransformStateDefault = (set: any) =>
  ({
    transform: "translate",
    setTransform: (transform: Transform) =>
      set(() => ({ transform: transform })),
    position: [0, 0, 0],
    setPosition: (position: [number, number, number]) =>
      set(() => ({ position: position })),
    scale: [1, 1, 1],
    setScale: (scale: [number, number, number]) =>
      set(() => ({ scale: scale })),
    rotation: [0, 0, 0],
    setRotation: (rotation: [number, number, number]) =>
      set(() => ({ rotation: rotation })),
  } as TransformState);
