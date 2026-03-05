import React, { useEffect, useRef, useState } from "react";
import { useExportOptionsStore } from "@/store/export";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useEntitiesStore } from "@/store/next/entities";
import { useCamerasStore } from "@/store/next/cameras";
import { Canvas, useFrame } from "@react-three/fiber";
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
import { Select } from "@react-three/postprocessing";

type SharedCameraState = React.RefObject<{
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  target: THREE.Vector3;
}>;

function SharedScene({
  cameraRef,
  isPreview,
}: {
  cameraRef?: React.RefObject<THREE.PerspectiveCamera | null>;
  isPreview?: boolean;
}) {
  const entities = useEntitiesStore((state) => state.entities);

  return (
    <>
      <Select enabled>
        <group>
          <mesh>
            <boxGeometry />
            <meshStandardMaterial color="hotpink" />
          </mesh>
          <mesh position={[0, 0, 2]}>
            <boxGeometry />
            <meshStandardMaterial color="hotpink" />
          </mesh>
        </group>
      </Select>

      {Object.values(entities).map((entity) => (
        <EntityComponent
          isPreview={isPreview}
          key={entity.uuid}
          uuid={entity.uuid}
        />
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
  useHelper(camera2Ref, THREE.CameraHelper);

  return (
    <>
      <color attach="background" args={["#1a1a1a"]} />
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
      <OrbitControls makeDefault enabled={orbitEnabled} />
      <SharedScene cameraRef={camera2Ref} />
      {/* <SyncCameraFromRef cameraRef={camera2Ref} stateRef={sharedCameraState} /> */}

      <TransformControls
        object={camera2Ref}
        mode="translate"
        onMouseDown={() => (isDragging.current = true)}
        onMouseUp={() => (isDragging.current = false)}
      />

      {/* Bidirectional sync — direction depends on who's dragging */}
      <BidirectionalCameraSync
        cameraRef={camera2Ref}
        stateRef={sharedCameraState}
        isDragging={isDragging}
      />

      <GizmoHelper renderPriority={1} alignment="bottom-right">
        <GizmoViewport labelColor="white" />
      </GizmoHelper>
      <Grid infiniteGrid sectionColor="#a09f9f" cellColor="#868686" />
      <ContactShadows
        frames={1}
        position={[0, -0.5, 0]}
        scale={10}
        opacity={0.4}
        far={1}
        blur={2}
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
  return (
    <>
      <color attach="background" args={["#111111"]} />
      <CameraControls ref={controlsRef} makeDefault enabled={orbitEnabled} />
      <SyncPreviewCamera
        stateRef={sharedCameraState}
        isDragging={isDragging}
        controlsRef={controlsRef}
      />
      <PostProcessingEffectsComposer />

      <SharedScene isPreview />
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

  const sharedCameraState = useRef({
    position: new THREE.Vector3(5, 5, 5),
    quaternion: new THREE.Quaternion(),
    target: new THREE.Vector3(0, 0, 0),
  });

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
          <Canvas>
            <EditorScene
              isDragging={isDragging}
              orbitEnabled={cameraGlobalSettings.orbitControls}
              sharedCameraState={sharedCameraState}
            />
          </Canvas>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="40%" style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10 }}>
            <button onClick={() => setShowGizmo(!showGizmo)}>
              {showGizmo ? "Hide Gizmo" : "Show Gizmo"}
            </button>
          </div>
          <Canvas className="rendering-[pixelated]">
            <PreviewScene
              isDragging={isDragging}
              showGizmo={showGizmo}
              orbitEnabled={cameraGlobalSettings.orbitControls}
              sharedCameraState={sharedCameraState}
            />
          </Canvas>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ResizablePanel>
  );
}

// export function AssetCreation() {
//   const exportedImages = useExportOptionsStore((state) => state.images);
//   const cameraGlobalSettings = useCamerasStore((state) => state.globalSettings);

//   const containerRef = useRef<HTMLDivElement>(null!);
//   const view1Ref = useRef<HTMLDivElement>(null!);
//   const view2Ref = useRef<HTMLDivElement>(null!);
//   const isDragging = useRef(false);

//   const sharedCameraState = useRef({
//     position: new THREE.Vector3(5, 5, 5),
//     quaternion: new THREE.Quaternion(),
//     target: new THREE.Vector3(0, 0, 0), // ← add this
//   });

//   useEffect(() => {
//     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
//       if (exportedImages.length === 0) return;
//       e.preventDefault();
//       e.returnValue = true;
//     };
//     window.addEventListener("beforeunload", handleBeforeUnload);
//     return () => window.removeEventListener("beforeunload", handleBeforeUnload);
//   }, [exportedImages]);

//   const [showGizmo, setShowGizmo] = useState(false);

//   return (
//     <ResizablePanel defaultSize="75%">
//       <div
//         ref={containerRef}
//         style={{
//           position: "relative",
//           width: "100%",
//           height: "100%",
//           overflow: "hidden", // ← this is what clips the canvas
//         }}
//       >
//         <ResizablePanelGroup orientation="vertical">
//           <ResizablePanel defaultSize="60%">
//             <div ref={view1Ref} style={{ width: "100%", height: "100%" }} />
//           </ResizablePanel>

//           <ResizableHandle withHandle />

//           <ResizablePanel
//             defaultSize="40%"
//             className="overflow-hidden flex justify-center items-center w-full"
//           >
//             <div
//               style={{
//                 height: "100%",
//                 width: "100%",
//                 overflow: "hidden",
//                 position: "relative",
//               }}
//             >
//               {/* Buttons float above, not inside the tracked div */}
//               <div
//                 style={{
//                   position: "absolute",
//                   top: 8,
//                   left: 8,
//                   zIndex: 10,
//                   pointerEvents: "auto",
//                 }}
//               >
//                 <button onClick={() => setShowGizmo(!showGizmo)}>
//                   {showGizmo ? "Hide Gizmo" : "Show Gizmo"}
//                 </button>
//               </div>
//               <div ref={view2Ref} style={{ width: "100%", height: "100%" }} />
//             </div>
//           </ResizablePanel>
//         </ResizablePanelGroup>

//         <Canvas
//           eventSource={containerRef}
//           style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
//         >
//           <View track={view1Ref} index={1}>
//             <EditorScene
//               isDragging={isDragging}
//               orbitEnabled={cameraGlobalSettings.orbitControls}
//               sharedCameraState={sharedCameraState}
//             />
//           </View>
//           <View track={view2Ref} index={2}>
//             <PreviewScene
//               isDragging={isDragging}
//               showGizmo={showGizmo}
//               orbitEnabled={cameraGlobalSettings.orbitControls}
//               sharedCameraState={sharedCameraState}
//             />
//           </View>
//           <View.Port />
//           <PreviewEffects />
//         </Canvas>
//       </div>
//     </ResizablePanel>
//   );
// }

export default AssetCreation;
