import type { CameraType } from "@/types/camera";
import { create } from "zustand";
import { TransformStateDefault, type TransformState } from "./common/transform";
import { UpdatableUIStateDefault, type UpdatableUIState } from "./common/ui";

interface CameraState extends TransformState, UpdatableUIState {
  useGesturesControls: boolean;
  setUseGesturesControls: (useGesturesControls: boolean) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  fov: number;
  setFov: (fov: number) => void;
  type: CameraType;
  setType: (type: CameraType) => void;
}

export const useCameraStore = create<CameraState>((set) => {
  const { position, ...transformState } = TransformStateDefault(set);

  position[0] = 10;
  position[1] = 1;
  position[2] = 10;

  return {
    ...UpdatableUIStateDefault(set),
    ...transformState,
    position,
    useGesturesControls: true,
    setUseGesturesControls: (useGesturesControls: boolean) =>
      set(() => ({ useGesturesControls: useGesturesControls })),
    zoom: 1,
    setZoom: (zoom: number) => set(() => ({ zoom: zoom })),
    fov: 30,
    setFov: (fov: number) => set(() => ({ fov: fov })),
    type: "perspective",
    setType: (type: CameraType) => set(() => ({ type: type })),
  };
});
