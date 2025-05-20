import * as THREE from "three";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { Select } from "@react-three/postprocessing";
import { useModelStore } from "@/store/model";
import { useEffectsStore } from "@/store/effects";

export function Box(props: ThreeElements["mesh"]) {
  const position = useModelStore((state) => state.position);
  const rotation = useModelStore((state) => state.rotation);
  const scale = useModelStore((state) => state.scale);
  const modelRef = useModelStore((state) => state.ref);
  const setModelRef = useModelStore((state) => state.setRef);
  const outline = useEffectsStore((state) => state.outline);

  useFrame((_, delta) => {
    if (!modelRef) return;
    modelRef.rotation!.x += delta;
  });
  return (
    <Select enabled={outline.enabled}>
      <mesh
        {...props}
        ref={(node: THREE.Object3D) => {
          setModelRef(node);
        }}
        scale={scale}
        position={position}
        rotation={rotation}
      >
        <boxGeometry args={[100, 100, 100]} />
        <meshStandardMaterial color={"#2f74c0"} />
      </mesh>
    </Select>
  );
}
