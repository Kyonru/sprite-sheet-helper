import * as THREE from "three";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { Select } from "@react-three/postprocessing";
import { useModelStore } from "@/store/model";
import { useEffectsStore } from "@/store/effects";
import { useRef } from "react";
import { useAnimationStore } from "@/store/animation";
import { interpolateKeyframes } from "@/utils/easing";

export function Box(props: ThreeElements["mesh"]) {
  const position = useModelStore((state) => state.position);
  const rotation = useModelStore((state) => state.rotation);
  const scale = useModelStore((state) => state.scale);
  const modelRef = useModelStore((state) => state.ref);
  const setModelRef = useModelStore((state) => state.setRef);
  const outline = useEffectsStore((state) => state.outline);

  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);
  const timeline = useAnimationStore((state) => state.timeline);
  const increaseTime = useAnimationStore((state) => state.increaseTime);
  const currentTime = useAnimationStore((state) => state.time);
  const playing = useAnimationStore((state) => state.playing);

  useFrame((_, delta) => {
    if (!modelRef || !playing) return;
    const time = currentTime + delta;
    const object = timeline.find((m) => m.id === modelRef?.uuid);

    if (!object) return;

    const xTrack = object.tracks.find((t) => t.property === "x");
    const opacityTrack = object.tracks.find((t) => t.property === "opacity");

    if (xTrack) {
      modelRef.position.x = interpolateKeyframes(xTrack.keyframes, time);
    }

    if (opacityTrack) {
      console.log(interpolateKeyframes(opacityTrack.keyframes, time));
      materialRef.current.opacity = interpolateKeyframes(
        opacityTrack.keyframes,
        time
      );
    }

    increaseTime(delta);
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
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          transparent
          ref={materialRef}
          color={"#2f74c0"}
          depthWrite={false}
        />
      </mesh>
    </Select>
  );
}
