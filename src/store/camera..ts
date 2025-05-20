import type { CameraType } from "@/types/camera";
import { create } from "zustand";

interface CameraState {
  position: [number, number, number];
  setPosition: (position: [number, number, number]) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  fov: number;
  setFov: (fov: number) => void;
  type: CameraType;
  setType: (type: CameraType) => void;
}

export const useCameraStore = create<CameraState>((set) => ({
  position: [0, 0, 200],
  setPosition: (position: [number, number, number]) =>
    set(() => ({ position: position })),
  zoom: 1,
  setZoom: (zoom: number) => set(() => ({ zoom: zoom })),
  fov: 30,
  setFov: (fov: number) => set(() => ({ fov: fov })),
  type: "perspective",
  setType: (type: CameraType) => set(() => ({ type: type })),
}));
