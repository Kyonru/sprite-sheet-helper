// stores/cameras.ts
import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";
import type { CameraComponent } from "@/types/ecs";
import type { CameraType } from "@/types/camera";

export const DEFAULT_PERSPECTIVE_CAMERA: CameraComponent = {
  type: "perspective" as CameraType,
  fov: 75,
  near: 0.1,
  far: 1000,
  zoom: 50,
  target: [0, 0, 0],
};

export const DEFAULT_ORTHOGRAPHIC_CAMERA: CameraComponent = {
  type: "orthographic" as CameraType,
  zoom: 50,
  near: 0.1,
  far: 1000,
  target: [0, 0, 0],
};

export interface GlobalSettings {
  orbitControls: boolean;
}

interface CamerasState {
  cameras: Record<string, CameraComponent>;
  activeCameraUuid: string | null;
  globalSettings: GlobalSettings;
}

interface CamerasActions {
  initCamera: (uuid: string, overrides?: Partial<CameraComponent>) => void;
  setCamera: (uuid: string, props: Partial<CameraComponent>) => void;
  setActiveCamera: (uuid: string) => void;
  removeCamera: (uuid: string) => void;
  setGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  hydrate: (
    cameras: Record<string, CameraComponent>,
    activeCameraUuid: string | null,
  ) => void;
}

export const useCamerasStore = create<CamerasState & CamerasActions>()(
  inspector(
    (set) => ({
      cameras: {},
      activeCameraUuid: null,
      globalSettings: {
        orbitControls: true,
      },

      initCamera: (uuid, overrides = {}) =>
        set((state) => ({
          cameras: {
            ...state.cameras,
            [uuid]: {
              ...DEFAULT_PERSPECTIVE_CAMERA,
              type: "perspective" as CameraType,
              ...overrides,
            },
          },
        })),

      setCamera: (uuid, props) =>
        set((state) => ({
          cameras: {
            ...state.cameras,
            [uuid]: { ...state.cameras[uuid], ...props } as CameraComponent,
          },
        })),

      setActiveCamera: (uuid) => set({ activeCameraUuid: uuid }),

      removeCamera: (uuid) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...rest } = state.cameras;
          return {
            cameras: rest,
            activeCameraUuid:
              state.activeCameraUuid === uuid ? null : state.activeCameraUuid,
          };
        }),

      setGlobalSettings: (settings) =>
        set((state) => {
          return {
            globalSettings: {
              ...state.globalSettings,
              ...settings,
            },
          };
        }),

      hydrate: (cameras, activeCameraUuid) =>
        set({ cameras, activeCameraUuid }),
    }),
    { name: "Cameras" },
  ),
);

export const useCamera = (uuid?: string) =>
  useCamerasStore((state) => (uuid ? state.cameras[uuid] : undefined));

export const useActiveCamera = () =>
  useCamerasStore((state) =>
    state.activeCameraUuid ? state.cameras[state.activeCameraUuid] : null,
  );
