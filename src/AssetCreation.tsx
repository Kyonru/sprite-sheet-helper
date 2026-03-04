// import "./App.css";
// import { useEffect, useRef, useState } from "react";
// import { Canvas } from "@react-three/fiber";
// import { useExportOptionsStore } from "./store/export";

import AssetCreation from "./components/panels/scene";

// import {
//   ResizableHandle,
//   ResizablePanel,
//   ResizablePanelGroup,
// } from "@/components/ui/resizable";

// import {
//   CameraControls,
//   ContactShadows,
//   Environment,
//   GizmoHelper,
//   GizmoViewport,
//   Grid,
//   Lightformer,
//   OrbitControls,
//   OrthographicCamera,
//   PerspectiveCamera,
//   useHelper,
// } from "@react-three/drei";
// import { useEntitiesStore } from "./store/next/entities";
// import { useTransform, useTransformsStore } from "./store/next/transforms";
// import { useCamerasStore } from "./store/next/cameras";
// // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// // @ts-ignore
// import { TransformControls as TransformControlsRef } from "three/examples/jsm/controls/TransformControls";
// import { TransformControls } from "@react-three/drei";
// import { LightComponent } from "./components/lights/base";
// import { useFrameValues } from "./hooks/use-frame-values";
// import { useExport } from "./hooks/use-export";
// import * as THREE from "three";

// function EntityComponent({ uuid }: { uuid: string }) {
//   const entity = useEntitiesStore((state) => state.entities[uuid]);
//   const transform = useTransform(uuid);
//   const transformMode = useTransformsStore((state) => state.mode);
//   const selected = useEntitiesStore((state) => state.selected);

//   const controlsRef = useRef<TransformControlsRef>(null!);
//   const setTransform = useTransformsStore((state) => state.setTransform);

//   if (!entity) return null;

//   let child = <></>;

//   if (entity.type === "light") {
//     child = <LightComponent uuid={uuid} />;
//   }

//   if (!transform) return null;

//   return (
//     <TransformControls
//       enabled={selected === uuid}
//       showX={selected === uuid}
//       showY={selected === uuid}
//       showZ={selected === uuid}
//       ref={controlsRef}
//       mode={transformMode}
//       onMouseUp={() => {
//         if (!controlsRef.current?.object) return;
//         const object = controlsRef.current.object;

//         setTransform(uuid, {
//           position: [object.position.x, object.position.y, object.position.z],
//           rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
//           scale: [object.scale.x, object.scale.y, object.scale.z],
//         });
//       }}
//       position={transform.position}
//       rotation={transform.rotation}
//       scale={transform.scale}
//     >
//       {child}
//     </TransformControls>
//   );
// }

// function SharedScene() {
//   const entities = useEntitiesStore((state) => state.entities);

//   return (
//     <>
//       {Object.values(entities).map((entity) => (
//         <EntityComponent key={entity.uuid} uuid={entity.uuid} />
//       ))}
//       <mesh>
//         <boxGeometry />
//         <meshStandardMaterial color="hotpink" />
//       </mesh>
//     </>
//   );
// }

// function CameraHelper({
//   spriteCamera,
// }: {
//   spriteCamera: [number, number, number];
// }) {
//   const cameraRef = useRef<THREE.PerspectiveCamera>(null!);
//   // const [mycam, setMycam] = useState<THREE.OrthographicCamera | null>();
//   const helper = useHelper(cameraRef, THREE.CameraHelper);

//   if (cameraRef.current) {
//     cameraRef.current.lookAt([0, 0, 0]);
//   }

//   return (
//     <>
//       <PerspectiveCamera
//         makeDefault={false}
//         position={[5, 5, 5]}
//         ref={cameraRef}
//         lookAt={[0, 0, 0]}
//       />
//     </>
//   );
// }

// function EnableExport() {
//   useExport();

//   return null;
// }

// function AssetCreation() {
//   const exportedImages = useExportOptionsStore((state) => state.images);
//   const cameraGlobalSettings = useCamerasStore((state) => state.globalSettings);
//   const { previewHeight, previewWidth } = useFrameValues();

//   useEffect(() => {
//     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
//       if (exportedImages.length === 0) return;
//       e.preventDefault();
//       // Deprecated, but still required for most browsers to trigger the confirmation
//       e.returnValue = true;
//     };

//     window.addEventListener("beforeunload", handleBeforeUnload);

//     return () => {
//       window.removeEventListener("beforeunload", handleBeforeUnload);
//     };
//   }, [exportedImages]);

//   const spriteCamera: [number, number, number] = [5, 5, 5];

//   return (
//     <>
//       <ResizablePanel defaultSize="75%">
//         <ResizablePanelGroup orientation="vertical">
//           <ResizablePanel
//             defaultSize="60%"
//             className="overflow-hidden overflow-y-scroll"
//           >
//             <Canvas>
//               <PerspectiveCamera makeDefault position={[0, 0, 5]} />
//               <CameraHelper spriteCamera={spriteCamera} />
//               <OrbitControls
//                 makeDefault
//                 enabled={cameraGlobalSettings.orbitControls}
//               />
//               <SharedScene />

//               <Grid
//                 infiniteGrid
//                 sectionColor={"#a09f9f"}
//                 cellColor={"#868686"}
//               />

//               <Environment
//                 frames={1}
//                 resolution={256}
//                 background="only"
//                 blur={1}
//               >
//                 <Lightformer
//                   intensity={1}
//                   rotation-x={Math.PI / 2}
//                   position={[0, 4, -9]}
//                   scale={[10, 1, 1]}
//                 />
//                 <Lightformer
//                   intensity={1}
//                   rotation-x={Math.PI / 2}
//                   position={[0, 4, -6]}
//                   scale={[10, 1, 1]}
//                 />
//                 <Lightformer
//                   intensity={1}
//                   rotation-x={Math.PI / 2}
//                   position={[0, 4, -3]}
//                   scale={[10, 1, 1]}
//                 />
//                 <Lightformer
//                   intensity={1}
//                   rotation-x={Math.PI / 2}
//                   position={[0, 4, 0]}
//                   scale={[10, 1, 1]}
//                 />
//                 <Lightformer
//                   intensity={1}
//                   rotation-x={Math.PI / 2}
//                   position={[0, 4, 3]}
//                   scale={[10, 1, 1]}
//                 />
//                 <Lightformer
//                   intensity={1}
//                   rotation-x={Math.PI / 2}
//                   position={[0, 4, 6]}
//                   scale={[10, 1, 1]}
//                 />
//                 <Lightformer
//                   intensity={1}
//                   rotation-x={Math.PI / 2}
//                   position={[0, 4, 9]}
//                   scale={[10, 1, 1]}
//                 />
//                 {/* Sides */}
//                 <Lightformer
//                   intensity={1}
//                   rotation-y={Math.PI / 2}
//                   position={[-50, 2, 0]}
//                   scale={[100, 2, 1]}
//                 />
//                 <Lightformer
//                   intensity={1}
//                   rotation-y={-Math.PI / 2}
//                   position={[50, 2, 0]}
//                   scale={[100, 2, 1]}
//                 />
//                 {/* Key */}
//                 <Lightformer
//                   form="ring"
//                   color="red"
//                   intensity={1}
//                   scale={2}
//                   position={[10, 5, 10]}
//                   onUpdate={(self) => self.lookAt(0, 0, 0)}
//                 />
//               </Environment>
//               <ContactShadows
//                 frames={1}
//                 position={[0, -0.5, 0]}
//                 scale={10}
//                 opacity={0.4}
//                 far={1}
//                 blur={2}
//               />

//               <GizmoHelper alignment="bottom-right">
//                 <GizmoViewport labelColor="white" />
//               </GizmoHelper>
//             </Canvas>
//           </ResizablePanel>
//           <ResizableHandle withHandle />
//           <ResizablePanel
//             defaultSize="40%"
//             className="overflow-hidden overflow-y-scroll justify-center items-center w-full flex"
//           >
//             <div
//               className="border-1 border-chart-3/25"
//               style={{
//                 height: previewHeight,
//                 width: previewWidth,
//               }}
//             >
//               <Canvas>
//                 <PerspectiveCamera lookAt={[0, 0, 0]} position={spriteCamera} />
//                 <OrbitControls
//                   makeDefault
//                   enabled={cameraGlobalSettings.orbitControls}
//                 />
//                 <SharedScene />
//                 <EnableExport />
//               </Canvas>
//             </div>
//           </ResizablePanel>
//         </ResizablePanelGroup>
//       </ResizablePanel>
//     </>
//   );
// }

export default AssetCreation;
