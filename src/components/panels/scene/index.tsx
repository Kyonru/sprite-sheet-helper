import React, { useEffect, useRef, useState } from "react";
import { ResizablePanel } from "@/components/ui/resizable";
import { GripHorizontalIcon, RotateCcwIcon } from "lucide-react";
import { useEntitiesStore } from "@/store/next/entities";
import { useCamerasStore } from "@/store/next/cameras";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  OrthographicCamera,
  Grid,
  GizmoHelper,
  GizmoViewport,
  useHelper,
  CameraControls,
  TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import { EntityComponent } from "@/components/entity";
import { PostProcessingEffectsComposer } from "./composer";
import { useTransformsStore } from "@/store/next/transforms";
import { useExport } from "@/hooks/next/use-export";
import { useSharedScene } from "@/context/shared-scene";
import {
  EntityContextProvider,
  useEntityContext,
} from "@/context/next/entity-context";
import { LAYERS } from "./constants";
import { useMainPanelContext } from "../main/context";
import { EventType, PubSub } from "@/lib/events";
import { useTarget } from "@/store/next/targets";
import { useSettingsStore } from "@/store/next/settings";
import { Text } from "@react-three/drei";
import type {
  PerspectiveCameraComponent,
  OrthographicCameraComponent,
  Transform,
} from "@/types/ecs";
import { setGLContext } from "@/lib/gl-context";
import { useHistoryStore } from "@/store/next/history";
import { setAppTitle } from "@/utils/app.web";

type SharedCameraState = React.RefObject<{
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  target: THREE.Vector3;
}>;

type FloatingPreviewPosition = {
  x: number;
  y: number;
};

type FloatingPreviewDrag = {
  origin: FloatingPreviewPosition;
  pointerX: number;
  pointerY: number;
};

function clampFloatingPreviewPosition(
  position: FloatingPreviewPosition,
  container: HTMLElement,
  panel: HTMLElement,
): FloatingPreviewPosition {
  const padding = 8;
  const maxX = Math.max(
    padding,
    container.clientWidth - panel.offsetWidth - padding,
  );
  const maxY = Math.max(
    padding,
    container.clientHeight - panel.offsetHeight - padding,
  );

  return {
    x: Math.min(Math.max(position.x, padding), maxX),
    y: Math.min(Math.max(position.y, padding), maxY),
  };
}

function CameraLabel({
  cameraRef,
}: {
  cameraRef: React.RefObject<THREE.Camera | null>;
}) {
  const [pos, setPos] = useState<[number, number, number]>([0, 0, 0]);

  const cameraUUID = useCamerasStore((state) => state.mainCamera);
  const selected = useEntitiesStore((state) => state.selected);
  const { isPreview } = useEntityContext();
  const isSelected = selected === cameraUUID;

  useFrame(() => {
    if (!cameraRef.current) return;
    const { x, y, z } = cameraRef.current.position;
    setPos([x, y + 0.4, z]);
  });

  return (
    <Text
      position={pos}
      fontSize={0.5}
      color="white"
      anchorX="center"
      anchorY="bottom"
      outlineWidth={0.008}
      outlineColor="black"
      layers={LAYERS.LAYER_EDITOR_ONLY}
      visible={isSelected && !isPreview}
    >
      Camera
    </Text>
  );
}

function SharedScene({
  cameraRef,
}: {
  cameraRef?: React.RefObject<THREE.Camera | null>;
}) {
  const entities = useEntitiesStore((state) => state.entities);
  const cameraUUID = useCamerasStore((state) => state.mainCamera);
  const camera = useCamerasStore((state) =>
    cameraUUID ? state.cameras[cameraUUID] : undefined,
  );
  const isOrthographic = camera?.type === "orthographic";

  return (
    <>
      {Object.values(entities).map((entity) => (
        <EntityComponent key={entity.uuid} uuid={entity.uuid} />
      ))}
      {cameraRef && (
        isOrthographic ? (
          <OrthographicCamera
            ref={cameraRef as React.RefObject<THREE.OrthographicCamera>}
            position={[5, 5, 5]}
            near={camera.near}
            far={camera.far}
            zoom={(camera as OrthographicCameraComponent).zoom}
          />
        ) : (
          <PerspectiveCamera
            ref={cameraRef as React.RefObject<THREE.PerspectiveCamera>}
            position={[5, 5, 5]}
            fov={45}
          />
        )
      )}
    </>
  );
}

function SyncCameraFromStore({
  controlsRef,
  sharedCameraState,
}: {
  controlsRef: React.RefObject<CameraControls>;
  sharedCameraState: SharedCameraState;
}) {
  const cameraUUID = useCamerasStore((state) => state.mainCamera);
  const transformNode = useTransformsStore((state) =>
    cameraUUID ? state.transforms[cameraUUID] : undefined,
  );
  const cameraValues = useCamerasStore((state) =>
    cameraUUID ? state.cameras[cameraUUID] : undefined,
  );
  const target = useTarget(cameraUUID);

  useEffect(() => {
    if (!transformNode?.position || !controlsRef.current) return;
    const [px, py, pz] = transformNode.position;
    const target = controlsRef.current.getTarget(new THREE.Vector3());
    controlsRef.current.setLookAt(
      px,
      py,
      pz,
      target.x,
      target.y,
      target.z,
      false,
    );
    controlsRef.current.saveState();

    sharedCameraState.current.position.set(px, py, pz);
    if (transformNode.rotation) {
      const euler = new THREE.Euler(
        ...(transformNode.rotation as [number, number, number]),
      );
      sharedCameraState.current.quaternion.setFromEuler(euler);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformNode?.position, transformNode?.rotation]);

  useEffect(() => {
    if (!cameraValues || !controlsRef.current) return;
    const camera = controlsRef.current.camera;

    camera.near = cameraValues.near;
    camera.far = cameraValues.far;
    if (
      cameraValues.type === "perspective" &&
      camera instanceof THREE.PerspectiveCamera
    ) {
      const values = cameraValues as PerspectiveCameraComponent;
      camera.fov = values.fov;
    }
    if (
      cameraValues.type === "orthographic" &&
      camera instanceof THREE.OrthographicCamera
    ) {
      const values = cameraValues as OrthographicCameraComponent;
      camera.zoom = values.zoom;
    }
    camera.updateProjectionMatrix();
  }, [cameraValues, controlsRef]);

  useFrame(({ camera }) => {
    if (target) {
      controlsRef.current.setTarget(target[0], target[1], target[2]);
    }
    sharedCameraState.current.position.copy(camera.position);
    sharedCameraState.current.quaternion.copy(camera.quaternion);
  });

  useEffect(() => {
    const changeCamera = ({
      position,
      target = [0, 0, 0],
    }: {
      position: [number, number, number];
      target?: [number, number, number];
    }) => {
      controlsRef.current?.setLookAt(...position, ...target, true);
    };

    const rotateCamera = ({
      degrees,
      direction,
    }: {
      degrees: number;
      direction: "left" | "right" | "up" | "down";
    }) => {
      const horizontal = direction === "left" || direction === "right";
      const vertical = direction === "up" || direction === "down";

      const horizontalRad =
        THREE.MathUtils.degToRad(degrees) * (direction === "left" ? 1 : -1);

      const verticalRad =
        THREE.MathUtils.degToRad(degrees) * (direction === "up" ? 1 : -1);

      if (horizontal) {
        controlsRef.current?.rotate(horizontalRad, 0, true);
      }

      if (vertical) {
        controlsRef.current?.rotate(0, verticalRad, true);
      }
    };

    PubSub.on(EventType.SET_CAMERA_ANGLE, changeCamera);
    PubSub.on(EventType.ROTATE_CAMERA, rotateCamera);
    return () => {
      PubSub.off(EventType.SET_CAMERA_ANGLE, changeCamera);
      PubSub.off(EventType.ROTATE_CAMERA, rotateCamera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsRef.current]);

  return null;
}

function SyncEditorCameraFromStore({
  cameraRef,
  isDragging,
  sharedCameraState,
}: {
  cameraRef: React.RefObject<THREE.Camera | null>;
  isDragging: React.RefObject<boolean>;
  sharedCameraState: SharedCameraState;
}) {
  useFrame(() => {
    if (!cameraRef.current || isDragging.current) return;
    cameraRef.current.position.copy(sharedCameraState.current.position);
    cameraRef.current.quaternion.copy(sharedCameraState.current.quaternion);
    cameraRef.current.updateMatrixWorld();
  });

  return null;
}

function EditorScene({
  sharedCameraState,
  isDragging,
}: {
  isDragging: React.RefObject<boolean>;
  sharedCameraState: SharedCameraState;
}) {
  const camera2Ref = useRef<THREE.Camera>(null!);
  const cameraHelper = useHelper(camera2Ref, THREE.CameraHelper);
  const selected = useEntitiesStore((state) => state.selected);
  const camera = useCamerasStore((state) => state.mainCamera);
  const transformMode = useTransformsStore((state) => state.mode);
  const setTransform = useTransformsStore((state) => state.setTransform);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null!);
  const { gridSectionColor, gridCellColor } = useSettingsStore();
  const { setCameraHelper } = useMainPanelContext();

  const isCameraSelected = selected === camera;

  const threeCamera = useThree((state) => state.camera);

  useEffect(() => {
    threeCamera.layers.enable(LAYERS.LAYER_EDITOR_ONLY);
  }, [threeCamera]);

  useEffect(() => {
    if (!cameraHelper.current) return;
    cameraHelper.current.layers.set(LAYERS.LAYER_EDITOR_ONLY);
  }, [cameraHelper]);

  useFrame(() => {
    if (!camera || !isDragging.current) return;
    const { x, y, z } = camera2Ref.current.position;
    const e = new THREE.Euler().setFromQuaternion(
      camera2Ref.current.quaternion,
    );
    const { x: sx, y: sy, z: sz } = camera2Ref.current.scale;

    setTransform(camera, {
      position: [x, y, z],
      rotation: [e.x, e.y, e.z],
      scale: [sx, sy, sz],
    });
  });

  const cameraValues = useCamerasStore((state) =>
    camera ? state.cameras[camera] : undefined,
  );

  useEffect(() => {
    if (!cameraHelper.current || !camera2Ref.current || !cameraValues) return;
    const cam = camera2Ref.current;
    cam.near = cameraValues.near;
    cam.far = cameraValues.far;
    if (
      cameraValues.type === "perspective" &&
      cam instanceof THREE.PerspectiveCamera
    ) {
      cam.fov = (cameraValues as PerspectiveCameraComponent).fov;
    }
    if (
      cameraValues.type === "orthographic" &&
      cam instanceof THREE.OrthographicCamera
    ) {
      cam.zoom = (cameraValues as OrthographicCameraComponent).zoom;
    }
    cam.updateProjectionMatrix();
    cameraHelper.current.update();
  }, [cameraValues, cameraHelper]);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.traverse((child: THREE.Object3D) => {
      child.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    });
    controlsRef.current.raycaster?.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsRef.current]);

  useEffect(() => {
    if (cameraHelper.current) {
      setCameraHelper(cameraHelper.current as THREE.CameraHelper);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraHelper.current]);

  return (
    <>
      <OrbitControls makeDefault />
      <SharedScene cameraRef={camera2Ref} />
      <TransformControls
        ref={controlsRef}
        camera={threeCamera}
        enabled={isCameraSelected}
        showX={isCameraSelected}
        showY={isCameraSelected}
        showZ={isCameraSelected}
        object={camera2Ref}
        mode={transformMode}
        onMouseDown={() => {
          isDragging.current = true;
        }}
        onMouseUp={() => {
          isDragging.current = false;

          if (!camera) return;
          const { x, y, z } = camera2Ref.current.position;
          const e = new THREE.Euler().setFromQuaternion(
            camera2Ref.current.quaternion,
          );
          const { x: sx, y: sy, z: sz } = camera2Ref.current.scale;

          const cameraTransform: Transform = {
            position: [x, y, z],
            rotation: [e.x, e.y, e.z],
            scale: [sx, sy, sz],
          };

          setTransform(camera, cameraTransform);
        }}
      />
      <CameraLabel cameraRef={camera2Ref} />
      <SyncEditorCameraFromStore
        cameraRef={camera2Ref}
        isDragging={isDragging}
        sharedCameraState={sharedCameraState}
      />
      <GizmoHelper
        layers={LAYERS.LAYER_EDITOR_ONLY}
        renderPriority={1}
        alignment="bottom-right"
      >
        <GizmoViewport labelColor="white" />
      </GizmoHelper>
      <Grid
        layers={LAYERS.LAYER_EDITOR_ONLY}
        infiniteGrid
        sectionColor={gridSectionColor}
        cellColor={gridCellColor}
      />
    </>
  );
}

const CameraManager = () => {
  const { set } = useThree();

  const cameraUUID = useCamerasStore((state) => state.mainCamera);
  const cameraType = useCamerasStore(
    (state) => state.cameras[cameraUUID || ""]?.type,
  );
  const cameraValues = useCamerasStore((state) =>
    cameraUUID ? state.cameras[cameraUUID] : undefined,
  );
  const cameraTransform = useTransformsStore((state) =>
    cameraUUID ? state.transforms[cameraUUID] : undefined,
  );
  const { exportWidth, exportHeight } = useSettingsStore();
  const { cameraHelper } = useMainPanelContext();

  useEffect(() => {
    if (!cameraValues || !cameraTransform) return;

    const aspect = exportWidth / exportHeight;
    const near = cameraValues.near;
    const far = cameraValues.far;
    const orthoSize = 10;
    const rotation = new THREE.Euler(
      ...(cameraTransform.rotation as [number, number, number]),
    );
    const orientation = new THREE.Quaternion().setFromEuler(rotation);

    const perspectiveValues = cameraValues as PerspectiveCameraComponent;
    const orthographicValues = cameraValues as OrthographicCameraComponent;

    // Create camera instances
    const perspectiveCamera = new THREE.PerspectiveCamera(
      perspectiveValues.fov,
      aspect,
      near,
      far,
    );
    perspectiveCamera.position.set(
      cameraTransform.position[0],
      cameraTransform.position[1],
      cameraTransform.position[2],
    );
    perspectiveCamera.quaternion.copy(orientation);

    const orthographicCamera = new THREE.OrthographicCamera(
      (orthoSize * aspect) / -2, // left
      (orthoSize * aspect) / 2, // right
      orthoSize / 2, // top
      orthoSize / -2, // bottom
      near,
      far,
    );
    orthographicCamera.position.set(
      cameraTransform.position[0],
      cameraTransform.position[1],
      cameraTransform.position[2],
    );
    orthographicCamera.quaternion.copy(orientation);
    orthographicCamera.zoom = orthographicValues.zoom;
    orthographicCamera.updateProjectionMatrix();

    // Determine the next camera based on the prop
    const nextCamera =
      cameraType === "perspective" ? perspectiveCamera : orthographicCamera;

    // Update the R3F state and the renderer's active camera
    set({ camera: nextCamera });

    // Ensure the projection matrix is updated after any changes to camera parameters
    nextCamera.updateProjectionMatrix();

    // Optional: if using controls (like OrbitControls), you may need to update them here.
    // e.g., if you had a controls ref: controls.current.object = nextCamera;
    if (cameraHelper) {
      cameraHelper.camera = nextCamera;
      cameraHelper.matrix = nextCamera.matrixWorld;
      cameraHelper.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraType, cameraValues, cameraTransform, exportWidth, exportHeight]);
  return null;
};

export function GLContextCapture() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    setGLContext(gl.getContext());
  }, [gl]);

  return null;
}

function PreviewScene({
  sharedCameraState,
  showGizmo,
}: {
  isDragging: React.RefObject<boolean>;
  sharedCameraState: SharedCameraState;
  showGizmo: boolean;
}) {
  const controlsRef = useRef<CameraControls>(null!);
  const { camera } = useThree();
  const cameraUUID = useCamerasStore((state) => state.mainCamera);
  const setTransform = useTransformsStore((state) => state.setTransform);
  const { setControls: setControlsRef } = useMainPanelContext();

  useEffect(() => {
    camera.layers.disableAll();
    camera.layers.enable(LAYERS.LAYER_DEFAULT);
  }, [camera]);

  useEffect(() => {
    if (controlsRef.current) {
      setControlsRef(controlsRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsRef.current]);

  useExport();

  return (
    <>
      <CameraControls
        ref={controlsRef}
        makeDefault
        onEnd={() => {
          const cam = controlsRef.current?.camera;
          if (!cam || !cameraUUID) return;
          const e = new THREE.Euler().setFromQuaternion(cam.quaternion);

          const { x: sx, y: sy, z: sz } = cam.scale;

          const cameraTransform: Transform = {
            position: [cam.position.x, cam.position.y, cam.position.z],
            rotation: [e.x, e.y, e.z],
            scale: [sx, sy, sz],
          };

          setTransform(cameraUUID, cameraTransform);
        }}
        onStart={() => {
          if (!cameraUUID) return;
        }}
      />
      <SyncCameraFromStore
        controlsRef={controlsRef}
        sharedCameraState={sharedCameraState}
      />
      <CameraManager />
      <PostProcessingEffectsComposer />
      <GLContextCapture />
      {showGizmo && (
        <GizmoHelper
          position={[-10, 0, 0]}
          renderPriority={1}
          alignment="bottom-right"
        >
          <GizmoViewport labelColor="white" />
        </GizmoHelper>
      )}
    </>
  );
}

function AssetCreation() {
  const isDirty = useHistoryStore((state) => state.isDirty);
  const name = useSettingsStore((state) => state.name);
  const isDragging = useRef(false);
  const [showGizmo, setShowGizmo] = useState(false);
  const {
    width: canvasWidth,
    height: canvasHeight,
    editorBackgroundColor,
  } = useSettingsStore();
  const glRef = useRef<THREE.WebGLRenderer>(null);

  const [zoom, setZoom] = useState(1);
  const previewHostRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const previewDragRef = useRef<FloatingPreviewDrag | null>(null);
  const [previewPosition, setPreviewPosition] =
    useState<FloatingPreviewPosition | null>(null);

  const sharedCameraState = useRef({
    position: new THREE.Vector3(5, 5, 5),
    quaternion: new THREE.Quaternion(),
    target: new THREE.Vector3(0, 0, 0),
  });

  const scene = useSharedScene();

  const resetPreviewPosition = () => {
    setPreviewPosition(null);
  };

  const handlePreviewDragStart = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;

    const host = previewHostRef.current;
    const panel = previewPanelRef.current;
    if (!host || !panel) return;

    const hostRect = host.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const origin = previewPosition ?? {
      x: panelRect.left - hostRect.left,
      y: panelRect.top - hostRect.top,
    };

    previewDragRef.current = {
      origin,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePreviewDragMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const drag = previewDragRef.current;
    const host = previewHostRef.current;
    const panel = previewPanelRef.current;
    if (!drag || !host || !panel) return;

    setPreviewPosition(
      clampFloatingPreviewPosition(
        {
          x: drag.origin.x + event.clientX - drag.pointerX,
          y: drag.origin.y + event.clientY - drag.pointerY,
        },
        host,
        panel,
      ),
    );
  };

  const handlePreviewDragEnd = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    previewDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const host = previewHostRef.current;
      const panel = previewPanelRef.current;
      if (!host || !panel) return;

      setPreviewPosition((position) =>
        position ? clampFloatingPreviewPosition(position, host, panel) : null,
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    glRef.current?.setClearColor(editorBackgroundColor, 1);
  }, [editorBackgroundColor]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = true;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    setAppTitle(`${name}${isDirty ? "*" : ""}`);
  }, [isDirty, name]);

  return (
    <ResizablePanel>
      <div
        ref={previewHostRef}
        className="relative h-full w-full overflow-hidden"
      >
        <EntityContextProvider isPreview={false}>
          <Canvas
            scene={scene}
            onCreated={({ gl, scene }) => {
              scene.background = null; // don't use scene background
              gl.setClearColor(editorBackgroundColor, 1);
              glRef.current = gl;
            }}
          >
            <EditorScene
              isDragging={isDragging}
              sharedCameraState={sharedCameraState}
            />
          </Canvas>
        </EntityContextProvider>

        <section
          ref={previewPanelRef}
          className="absolute z-20 flex min-h-56 min-w-80 resize flex-col overflow-hidden rounded-md border bg-background/95 shadow-xl backdrop-blur"
          style={
            previewPosition
              ? {
                  left: previewPosition.x,
                  top: previewPosition.y,
                  width: "min(520px, calc(100% - 16px))",
                  height: "min(360px, calc(100% - 16px))",
                }
              : {
                  right: 16,
                  bottom: 16,
                  width: "min(520px, calc(100% - 32px))",
                  height: "min(360px, calc(100% - 32px))",
                }
          }
        >
          <div
            className="flex h-10 shrink-0 cursor-grab select-none items-center gap-2 border-b px-2 active:cursor-grabbing"
            onPointerDown={handlePreviewDragStart}
            onPointerMove={handlePreviewDragMove}
            onPointerUp={handlePreviewDragEnd}
            onPointerCancel={handlePreviewDragEnd}
          >
            <GripHorizontalIcon className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              Preview Canvas
            </span>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs hover:bg-muted"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setShowGizmo(!showGizmo)}
            >
              {showGizmo ? "Hide Gizmo" : "Show Gizmo"}
            </button>
            <label
              className="flex items-center gap-2 text-xs text-muted-foreground"
              onPointerDown={(event) => event.stopPropagation()}
            >
              Zoom
              <input
                className="w-24 accent-primary"
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="grid size-7 place-items-center rounded hover:bg-muted"
              title="Reset preview position"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={resetPreviewPosition}
            >
              <RotateCcwIcon className="size-3.5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-black/20 p-3">
            <div className="flex min-h-full min-w-full items-center justify-center">
              <EntityContextProvider isPreview={true}>
                <Canvas
                  scene={scene}
                  style={{
                    width: canvasWidth * zoom,
                    height: canvasHeight * zoom,
                    aspectRatio: canvasWidth / canvasHeight,
                  }}
                  onCreated={({ gl, scene }) => {
                    scene.background = null;
                    gl.setClearColor("#000000", 0);
                  }}
                  gl={{ antialias: false, preserveDrawingBuffer: true }}
                  className="rendering-[pixelated] border-2 border-accent-800"
                >
                  <PreviewScene
                    isDragging={isDragging}
                    showGizmo={showGizmo}
                    sharedCameraState={sharedCameraState}
                  />
                </Canvas>
              </EntityContextProvider>
            </div>
          </div>
        </section>
      </div>
    </ResizablePanel>
  );
}

export default AssetCreation;
