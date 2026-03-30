import React, { useEffect, useRef, useState } from "react";
import { useExportOptionsStore } from "@/store/export";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useEntitiesStore } from "@/store/next/entities";
import { useCamerasStore } from "@/store/next/cameras";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Grid,
  GizmoHelper,
  GizmoViewport,
  ContactShadows,
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
import type { PerspectiveCameraComponent } from "@/types/ecs";

type SharedCameraState = React.RefObject<{
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  target: THREE.Vector3;
}>;

function CameraLabel({
  cameraRef,
}: {
  cameraRef: React.RefObject<THREE.PerspectiveCamera>;
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
  cameraRef?: React.RefObject<THREE.PerspectiveCamera | null>;
}) {
  const entities = useEntitiesStore((state) => state.entities);

  return (
    <>
      {Object.values(entities).map((entity) => (
        <EntityComponent key={entity.uuid} uuid={entity.uuid} />
      ))}
      {cameraRef && (
        <PerspectiveCamera ref={cameraRef} position={[5, 5, 5]} fov={45} />
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
    const camera = controlsRef.current.camera as THREE.PerspectiveCamera;
    const values = cameraValues as PerspectiveCameraComponent;

    camera.near = values.near;
    camera.far = values.far;
    camera.fov = values.fov;
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
      direction: "left" | "right";
    }) => {
      const rad =
        THREE.MathUtils.degToRad(degrees) * (direction === "left" ? 1 : -1);
      controlsRef.current?.rotate(rad, 0, true);
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
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
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
  orbitEnabled,
  sharedCameraState,
  isDragging,
}: {
  orbitEnabled: boolean;
  isDragging: React.RefObject<boolean>;
  sharedCameraState: SharedCameraState;
}) {
  const camera2Ref = useRef<THREE.PerspectiveCamera>(null!);
  const cameraHelper = useHelper(camera2Ref, THREE.CameraHelper);
  const selected = useEntitiesStore((state) => state.selected);
  const camera = useCamerasStore((state) => state.mainCamera);
  const transformMode = useTransformsStore((state) => state.mode);
  const setTransform = useTransformsStore((state) => state.setTransform);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null!);
  const { gridSectionColor, gridCellColor } = useSettingsStore();

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
    const cam = camera2Ref.current as THREE.PerspectiveCamera;
    cam.near = cameraValues.near;
    cam.far = cameraValues.far;
    cam.fov = (cameraValues as PerspectiveCameraComponent).fov;
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

  return (
    <>
      <OrbitControls makeDefault enabled={orbitEnabled} />
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
        onMouseDown={() => (isDragging.current = true)}
        onMouseUp={() => {
          isDragging.current = false;

          if (!camera) return;
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
      <ContactShadows
        frames={1}
        position={[0, -0.5, 0]}
        scale={10}
        opacity={0.4}
        far={1}
        blur={2}
        layers={LAYERS.LAYER_EDITOR_ONLY}
      />
    </>
  );
}

function PreviewScene({
  orbitEnabled,
  sharedCameraState,
  showGizmo,
}: {
  orbitEnabled: boolean;
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
        enabled={orbitEnabled}
        onEnd={() => {
          const cam = controlsRef.current?.camera;
          if (!cam || !cameraUUID) return;
          const e = new THREE.Euler().setFromQuaternion(cam.quaternion);

          const { x: sx, y: sy, z: sz } = cam.scale;

          setTransform(cameraUUID, {
            position: [cam.position.x, cam.position.y, cam.position.z],
            rotation: [e.x, e.y, e.z],
            scale: [sx, sy, sz],
          });
        }}
      />
      <SyncCameraFromStore
        controlsRef={controlsRef}
        sharedCameraState={sharedCameraState}
      />
      <PostProcessingEffectsComposer />
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

export function AssetCreation() {
  const exportedImages = useExportOptionsStore((state) => state.images);
  const cameraGlobalSettings = useCamerasStore((state) => state.globalSettings);
  const isDragging = useRef(false);
  const [showGizmo, setShowGizmo] = useState(false);
  const {
    width: canvasWidth,
    height: canvasHeight,
    editorBackgroundColor,
  } = useSettingsStore();
  const glRef = useRef<THREE.WebGLRenderer>(null);

  const [zoom, setZoom] = useState(1);

  const sharedCameraState = useRef({
    position: new THREE.Vector3(5, 5, 5),
    quaternion: new THREE.Quaternion(),
    target: new THREE.Vector3(0, 0, 0),
  });

  const scene = useSharedScene();

  useEffect(() => {
    glRef.current?.setClearColor(editorBackgroundColor, 1);
  }, [editorBackgroundColor]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (exportedImages.length === 0) return;
      e.preventDefault();
      e.returnValue = true;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [exportedImages]);

  return (
    <ResizablePanel defaultSize="75%">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize="60%" style={{ position: "relative" }}>
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
                orbitEnabled={cameraGlobalSettings.orbitControls}
                sharedCameraState={sharedCameraState}
              />
            </Canvas>
          </EntityContextProvider>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="40%" style={{ position: "relative" }}>
          <div
            className="flex flex-row items-center"
            style={{ position: "absolute", top: 8, left: 8, zIndex: 10 }}
          >
            <button onClick={() => setShowGizmo(!showGizmo)}>
              {showGizmo ? "Hide Gizmo" : "Show Gizmo"}
            </button>

            {/* slider zoom from 0.1 to 2.0 */}
            <input
              className="ml-5"
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
          </div>

          <div
            style={{
              aspectRatio: canvasWidth / canvasHeight,
              height: "100%",
            }}
            className="overflow-hidden overflow-y-scroll justify-center items-center w-full flex"
          >
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
                className="rendering-[pixelated]  border-accent-800 border-2"
              >
                <PreviewScene
                  isDragging={isDragging}
                  showGizmo={showGizmo}
                  orbitEnabled={cameraGlobalSettings.orbitControls}
                  sharedCameraState={sharedCameraState}
                />
              </Canvas>
            </EntityContextProvider>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ResizablePanel>
  );
}

export default AssetCreation;
