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
import { useFrameValues } from "@/hooks/use-frame-values";
import { useSharedScene } from "@/context/shared-scene";
import { EntityContextProvider } from "@/context/next/entity-context";
import { LAYERS } from "./constants";
import { useMainPanelContext } from "../main/context";

type SharedCameraState = React.RefObject<{
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  target: THREE.Vector3;
}>;

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
  }, [transformNode?.position, transformNode?.rotation]);

  useFrame(({ camera }) => {
    sharedCameraState.current.position.copy(camera.position);
    sharedCameraState.current.quaternion.copy(camera.quaternion);
  });

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

  const isCameraSelected = selected === camera;

  const threeCamera = useThree((state) => state.camera);
  const { camera: sceneCamera } = useThree();

  useEffect(() => {
    sceneCamera.layers.enable(LAYERS.LAYER_EDITOR_ONLY);
  }, [sceneCamera]);

  useEffect(() => {
    if (!cameraHelper.current) return;
    cameraHelper.current.layers.set(LAYERS.LAYER_EDITOR_ONLY);
  }, [cameraHelper]);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.traverse((child: THREE.Object3D) => {
      child.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    });
    controlsRef.current.raycaster?.layers.set(LAYERS.LAYER_EDITOR_ONLY);
  }, [controlsRef.current]);

  return (
    <>
      <color attach="background" args={["#1a1a1a"]} />
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
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
        sectionColor="#a09f9f"
        cellColor="#868686"
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
  const { previewHeight, previewWidth } = useFrameValues();
  const [zoom, setZoom] = useState(1);

  const sharedCameraState = useRef({
    position: new THREE.Vector3(5, 5, 5),
    quaternion: new THREE.Quaternion(),
    target: new THREE.Vector3(0, 0, 0),
  });

  const scene = useSharedScene();

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
                gl.setClearColor("#1a1a1a", 1);
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
              aspectRatio: previewWidth / previewHeight,
              height: "100%",
            }}
            className="overflow-hidden overflow-y-scroll justify-center items-center w-full flex"
          >
            <EntityContextProvider isPreview={true}>
              <Canvas
                scene={scene}
                style={{
                  width: previewWidth * zoom,
                  height: previewHeight * zoom,
                  aspectRatio: previewWidth / previewHeight,
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
