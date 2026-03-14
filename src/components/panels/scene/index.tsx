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

function SyncPreviewCamera({
  stateRef,
  isDragging,
  controlsRef,
}: {
  stateRef: SharedCameraState;
  isDragging: React.RefObject<boolean>;
  controlsRef: React.RefObject<CameraControls>;
}) {
  const wasDragging = useRef(false);
  const posBeforeDrag = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    if (isDragging.current) {
      if (!wasDragging.current) {
        posBeforeDrag.current.copy(stateRef.current.position);
        wasDragging.current = true;
      }

      camera.position.copy(stateRef.current.position);
      camera.quaternion.copy(stateRef.current.quaternion);
      camera.updateMatrixWorld();
    } else {
      if (wasDragging.current) {
        // Shift target by same delta as position moved
        const delta = stateRef.current.position
          .clone()
          .sub(posBeforeDrag.current);
        stateRef.current.target.add(delta);

        const { x, y, z } = stateRef.current.position;
        const { x: tx, y: ty, z: tz } = stateRef.current.target;
        controlsRef.current?.setLookAt(x, y, z, tx, ty, tz, false);
        wasDragging.current = false;
        controlsRef.current?.saveState();
      }
      stateRef.current.position.copy(camera.position);
      stateRef.current.quaternion.copy(camera.quaternion);
    }
  });
  return null;
}

function BidirectionalCameraSync({
  cameraRef,
  stateRef,
  isDragging,
}: {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  stateRef: SharedCameraState;
  isDragging: React.RefObject<boolean>;
}) {
  useFrame(() => {
    if (!cameraRef.current) return;
    if (isDragging.current) {
      // Editor → shared
      stateRef.current.position.copy(cameraRef.current.position);
      stateRef.current.quaternion.copy(cameraRef.current.quaternion);
    } else {
      // Shared → editor
      cameraRef.current.position.copy(stateRef.current.position);
      cameraRef.current.quaternion.copy(stateRef.current.quaternion);
      cameraRef.current.updateMatrixWorld();
    }
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

  return (
    <>
      <color attach="background" args={["#1a1a1a"]} />
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
      <OrbitControls makeDefault enabled={orbitEnabled} />
      <SharedScene cameraRef={camera2Ref} />
      {/* <SyncCameraFromRef cameraRef={camera2Ref} stateRef={sharedCameraState} /> */}
      <TransformControls
        camera={threeCamera}
        enabled={isCameraSelected}
        showX={isCameraSelected}
        showY={isCameraSelected}
        showZ={isCameraSelected}
        object={camera2Ref}
        mode={transformMode}
        // onUpdate={(self) => self.layers.set(LAYERS.LAYER_EDITOR_ONLY)}
        onMouseDown={() => (isDragging.current = true)}
        onMouseUp={() => (isDragging.current = false)}
      />
      {/* Bidirectional sync — direction depends on who's dragging */}
      <BidirectionalCameraSync
        cameraRef={camera2Ref}
        stateRef={sharedCameraState}
        isDragging={isDragging}
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
  isDragging,
}: {
  orbitEnabled: boolean;
  isDragging: React.RefObject<boolean>;
  sharedCameraState: SharedCameraState;
  showGizmo: boolean;
}) {
  const controlsRef = useRef<CameraControls>(null!);
  const { camera } = useThree();

  useEffect(() => {
    camera.layers.disableAll();
    camera.layers.enable(LAYERS.LAYER_DEFAULT);
  }, [camera]);

  useExport();

  return (
    <>
      <CameraControls ref={controlsRef} makeDefault enabled={orbitEnabled} />
      <SyncPreviewCamera
        stateRef={sharedCameraState}
        isDragging={isDragging}
        controlsRef={controlsRef}
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
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10 }}>
            <button onClick={() => setShowGizmo(!showGizmo)}>
              {showGizmo ? "Hide Gizmo" : "Show Gizmo"}
            </button>
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
                  width: previewWidth,
                  height: previewHeight,
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
