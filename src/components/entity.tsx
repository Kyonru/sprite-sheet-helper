import { useEffect, useRef } from "react";
import { useEntitiesStore } from "@/store/next/entities";
import { useTransform, useTransformsStore } from "@/store/next/transforms";
import { Text, TransformControls } from "@react-three/drei";
import { LightComponent } from "@/components/object/lights";
import { useEntityContext } from "@/context/next/entity-context";
import { ModelComponent } from "./object/model";
import * as THREE from "three";
import { useModelObject } from "@/store/next/models";
import { LAYERS } from "./panels/scene/constants";
import { useTarget, useTargetsStore } from "@/store/next/targets";
import { useFrame } from "@react-three/fiber";

function ObjectTarget({ uuid }: { uuid: string }) {
  const target = useTarget(uuid);
  const setTarget = useTargetsStore((state) => state.setTarget);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null!);
  const selected = useEntitiesStore((state) => state.selected);

  const isSelected = selected === uuid;
  const { isPreview } = useEntityContext();

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.traverse((child: THREE.Object3D) => {
      child.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    });
    controlsRef.current.raycaster?.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsRef.current]);

  useFrame(() => {
    if (!controlsRef.current || !target) return;

    const object = controlsRef.current.object;
    setTarget(uuid, [object.position.x, object.position.y, object.position.z]);
  });

  if (!target) return null;

  return (
    <>
      <TransformControls
        enabled={isSelected && !isPreview}
        showX={isSelected && !isPreview}
        showY={isSelected && !isPreview}
        showZ={isSelected && !isPreview}
        ref={controlsRef}
        mode={"translate"}
      />
      <Text
        position={[target[0], target[1] + 0.3, target[2]]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.008}
        outlineColor="black"
        layers={LAYERS.LAYER_EDITOR_ONLY}
        visible={isSelected && !isPreview}
      >
        Target
      </Text>
    </>
  );
}

export function EntityComponent({ uuid }: { uuid: string }) {
  const entity = useEntitiesStore((state) => state.entities[uuid]);
  const transform = useTransform(uuid);
  const transformMode = useTransformsStore((state) => state.mode);
  const selected = useEntitiesStore((state) => state.selected);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null!);
  const setTransform = useTransformsStore((state) => state.setTransform);
  const groupRef = useRef<THREE.Group>(null);
  const modelObject = useModelObject(uuid);
  const { isPreview } = useEntityContext();

  useEffect(() => {
    if (controlsRef.current && groupRef.current) {
      controlsRef.current.attach(groupRef.current);
    }
    const current = controlsRef.current;

    return () => {
      current?.detach();
    };
  }, [modelObject]);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.traverse((child: THREE.Object3D) => {
      child.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    });
    controlsRef.current.raycaster?.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsRef.current]);

  if (!entity || !transform) return null;
  if (entity.type === "camera") return <ObjectTarget uuid={uuid} />;

  let child = <></>;
  if (entity.type === "light") {
    child = <LightComponent uuid={uuid} />;
  }

  if (entity.type === "model") {
    child = <ModelComponent uuid={uuid} />;
  }

  const isSelected = selected === uuid;

  return (
    <>
      <TransformControls
        enabled={isSelected && !isPreview}
        showX={isSelected && !isPreview}
        showY={isSelected && !isPreview}
        showZ={isSelected && !isPreview}
        ref={controlsRef}
        mode={transformMode}
        onMouseUp={() => {
          if (!groupRef.current) return;
          const object = groupRef.current;
          setTransform(uuid, {
            position: [object.position.x, object.position.y, object.position.z],
            rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
            scale: [object.scale.x, object.scale.y, object.scale.z],
          });
        }}
      />
      <ObjectTarget uuid={uuid} />
      <group
        ref={groupRef}
        position={transform.position}
        rotation={transform.rotation}
        scale={transform.scale}
      >
        {child}
        <Text
          position={[0, 2, 0]}
          fontSize={0.5}
          color="white"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.008}
          outlineColor="black"
          layers={LAYERS.LAYER_EDITOR_ONLY}
          visible={!isPreview && selected === uuid}
        >
          {entity.name ?? entity.type}
        </Text>
      </group>
      {/* </TransformControls> */}
    </>
  );
}
