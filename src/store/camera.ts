import type { CameraType } from "@/types/camera";
import { create } from "zustand";
import { TransformStateDefault, type TransformState } from "./common/transform";
import { UpdatableUIStateDefault, type UpdatableUIState } from "./common/ui";
import { OrbitControls } from "three-stdlib";

interface OrbitSettings {
  autoRotate: boolean;
  autoRotateSpeed: number;

  enablePan: boolean;
  panSpeed: number;

  enableRotate: boolean;
  rotateSpeed: number;

  enableZoom: boolean;
  zoomSpeed: number;
  zoomToFocus: boolean;

  target0: [number, number, number];
}

interface CameraState extends TransformState, UpdatableUIState {
  useGesturesControls: boolean;
  setUseGesturesControls: (useGesturesControls: boolean) => void;
  orbitSettings: OrbitSettings;
  updateOrbitSettings: (orbitSettings: Partial<OrbitSettings>) => void;
  orbitRef: OrbitControls | null;
  setOrbitRef: (orbitRef: OrbitControls | null) => void;
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
    orbitRef: null,
    setOrbitRef: (orbitRef: OrbitControls | null) =>
      set(() => ({ orbitRef: orbitRef })),
    orbitSettings: {
      autoRotate: false,
      autoRotateSpeed: 2.0,

      enablePan: true,
      panSpeed: 1.0,

      enableRotate: true,
      rotateSpeed: 1.0,

      enableZoom: true,
      zoomSpeed: 1,
      zoomToFocus: true,

      target0: [0, 0, 0],
    },
    updateOrbitSettings: (orbitSettings: Partial<OrbitSettings>) =>
      set((state) => ({
        orbitSettings: {
          ...state.orbitSettings,
          ...orbitSettings,
        },
      })),
  };
});
