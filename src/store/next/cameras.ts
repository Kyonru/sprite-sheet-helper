// stores/cameras.ts
import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";
import type { CameraComponent, SnapshotEnabledStore } from "@/types/ecs";
import type { CameraType } from "@/types/camera";

export const DEFAULT_PERSPECTIVE_CAMERA: CameraComponent = {
  type: "perspective" as CameraType,
  fov: 75,
  near: 0.1,
  far: 100,
};

export const DEFAULT_ORTHOGRAPHIC_CAMERA: CameraComponent = {
  type: "orthographic" as CameraType,
  zoom: 50,
  near: 0.1,
  far: 100,
};

export interface GlobalSettings {
  orbitControls: boolean;
}

export interface CamerasState {
  cameras: Record<string, CameraComponent>;
  mainCamera?: string;
}

interface CamerasActions extends SnapshotEnabledStore<CamerasState> {
  initCamera: (uuid: string, overrides?: Partial<CameraComponent>) => void;
  setCamera: (uuid: string, props: Partial<CameraComponent>) => void;
  setActiveCamera: (uuid: string) => void;
  removeCamera: (uuid: string) => void;
  setCameraType: (uuid: string, type: CameraType) => void;
}

export const useCamerasStore = create<CamerasState & CamerasActions>()(
  inspector(
    (set, get) => ({
      cameras: {},
      mainCamera: undefined,

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

      setActiveCamera: (uuid) => set({ mainCamera: uuid }),

      setCameraType: (uuid, type) =>
        set((state) => {
          let defaults: CameraComponent = DEFAULT_PERSPECTIVE_CAMERA;
          if (type === "orthographic") {
            defaults = DEFAULT_ORTHOGRAPHIC_CAMERA;
          }

          return {
            cameras: {
              ...state.cameras,
              [uuid]: {
                ...defaults,
                ...state.cameras[uuid],
                type,
              },
            },
          };
        }),

      removeCamera: (uuid) =>
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [uuid]: _, ...rest } = state.cameras;
          return {
            cameras: rest,
            mainCamera:
              state.mainCamera === uuid ? undefined : state.mainCamera,
          };
        }),

      getSnapshot: () => {
        return {
          cameras: get().cameras,
          mainCamera: get().mainCamera,
        };
      },

      hydrate: (snapshot) =>
        set({
          cameras: snapshot.cameras,
          mainCamera: snapshot.mainCamera,
        }),
    }),
    { name: "Cameras" },
  ),
);

export const useCamera = (uuid?: string) =>
  useCamerasStore((state) => (uuid ? state.cameras[uuid] : undefined));

export const useActiveCamera = () =>
  useCamerasStore((state) =>
    state.mainCamera ? state.cameras[state.mainCamera] : null,
  );
