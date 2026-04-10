// stores/cameras.ts
import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";
import type { CameraComponent, SnapshotEnabledStore } from "@/types/ecs";
import type { CameraType } from "@/types/camera";
import { withHistory } from "../common/middlewares/history";
import { isEqual } from "@/utils/object";

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

const initialState: CamerasState = {
  cameras: {},
  mainCamera: undefined,
};

export const useCamerasStore = create<CamerasState & CamerasActions>()(
  inspector(
    withHistory(
      (set, get) => ({
        ...initialState,

        initCamera: (uuid, overrides = {}) =>
          set((state) => ({
            cameras: {
              ...state.cameras,
              [uuid]: {
                ...DEFAULT_PERSPECTIVE_CAMERA,
                type: "perspective",
                ...overrides,
              },
            },
          })),

        setCamera: (uuid, props) =>
          set((state) => ({
            cameras: {
              ...state.cameras,
              [uuid]: { ...state.cameras[uuid], ...props },
            },
          })),

        setActiveCamera: (uuid) => set({ mainCamera: uuid }),

        setCameraType: (uuid, type) =>
          set((state) => {
            const defaults =
              type === "orthographic"
                ? DEFAULT_ORTHOGRAPHIC_CAMERA
                : DEFAULT_PERSPECTIVE_CAMERA;

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

        reset: () => set(initialState),

        getSnapshot: () => ({
          cameras: get().cameras,
          mainCamera: get().mainCamera,
        }),

        hydrate: (snapshot) =>
          set({
            cameras: snapshot.cameras,
            mainCamera: snapshot.mainCamera,
          }),
      }),
      {
        name: "Cameras",

        watchers: [
          {
            select: (state) => ({
              cameras: state.cameras,
              mainCamera: state.mainCamera,
            }),

            toAction: (prev, next, api) => {
              const prevCams = prev.cameras;
              const nextCams = next.cameras;

              const prevKeys = new Set(Object.keys(prevCams));
              const nextKeys = new Set(Object.keys(nextCams));

              // ❌ INIT (ignore like entities)
              for (const uuid of nextKeys) {
                if (!prevKeys.has(uuid)) {
                  return null;
                }
              }

              // REMOVE
              for (const uuid of prevKeys) {
                if (!nextKeys.has(uuid)) {
                  return {
                    type: "camera/remove",
                    uuid,
                    from: prevCams[uuid],
                    to: null,

                    apply: ({ dir, value }) => {
                      if (dir === "forward") {
                        api.getState().removeCamera(uuid);
                      } else {
                        api.getState().initCamera(uuid, value);
                      }
                    },
                  };
                }
              }

              // TYPE CHANGE (important: detect before generic edit)
              for (const uuid of nextKeys) {
                const p = prevCams[uuid];
                const n = nextCams[uuid];

                if (p !== n && p.type !== n.type) {
                  return {
                    type: "camera/type",
                    uuid,
                    from: p.type,
                    to: n.type,

                    apply: ({ value }) => {
                      api.getState().setCameraType(uuid, value);
                    },
                  };
                }
              }

              // PARAM EDIT (fov, zoom, near, far…)
              for (const uuid of nextKeys) {
                const p = prevCams[uuid];
                const n = nextCams[uuid];

                if (p !== n) {
                  if (!isEqual(p, n)) {
                    return {
                      type: "camera/edit",
                      uuid,
                      from: p,
                      to: n,

                      apply: ({ value }) => {
                        api.getState().setCamera(uuid, value);
                      },
                    };
                  }
                }
              }

              return null;
            },

            mergeKey: (prev, next) => {
              const prevCams = prev.cameras;
              const nextCams = next.cameras;

              for (const uuid of Object.keys(nextCams)) {
                const p = prevCams[uuid];
                const n = nextCams[uuid];

                if (!p) continue; // skip init

                if (p !== n) {
                  if (p.type !== n.type) {
                    return `camera:${uuid}:type`;
                  }

                  return `camera:${uuid}:edit`;
                }
              }

              if (prev.mainCamera !== next.mainCamera) {
                return "camera:active";
              }

              return undefined;
            },
          },
        ],
      },
    ),
    { name: "Cameras" },
  ),
);

export const useCamera = (uuid?: string) =>
  useCamerasStore((state) => (uuid ? state.cameras[uuid] : undefined));

export const useActiveCamera = () =>
  useCamerasStore((state) =>
    state.mainCamera ? state.cameras[state.mainCamera] : null,
  );
