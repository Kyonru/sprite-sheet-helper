import { useEffect, useRef } from "react";
import { useEntitiesStore } from "@/store/next/entities";
import { useTransform, useTransformsStore } from "@/store/next/transforms";
import { TransformControls } from "@react-three/drei";
import { LightComponent } from "@/components/object/lights";
import { EntityContextProvider } from "@/context/next/entity-context";
import { ModelComponent } from "./object/model";
import * as THREE from "three";
import { useModelObject } from "@/store/next/models";

export function EntityComponent({
  uuid,
  isPreview,
}: {
  uuid: string;
  isPreview?: boolean;
}) {
  const entity = useEntitiesStore((state) => state.entities[uuid]);
  const transform = useTransform(uuid);
  const transformMode = useTransformsStore((state) => state.mode);
  const selected = useEntitiesStore((state) => state.selected);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null!);
  const setTransform = useTransformsStore((state) => state.setTransform);
  const groupRef = useRef<THREE.Group>(null);
  const modelObject = useModelObject(uuid);

  useEffect(() => {
    if (controlsRef.current && groupRef.current) {
      controlsRef.current.attach(groupRef.current);
    }
    const current = controlsRef.current;

    return () => {
      current?.detach();
    };
  }, [modelObject]);

  if (!entity || !transform) return null;

  let child = <></>;
  if (entity.type === "light") {
    child = <LightComponent uuid={uuid} />;
  }

  if (entity.type === "model") {
    child = <ModelComponent uuid={uuid} />;
  }

  if (entity.type === "camera") {
    return <></>;
  }

  return (
    <EntityContextProvider isPreview={isPreview}>
      <TransformControls
        enabled={selected === uuid && !isPreview}
        showX={selected === uuid && !isPreview}
        showY={selected === uuid && !isPreview}
        showZ={selected === uuid && !isPreview}
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
      <group
        ref={groupRef}
        position={transform.position}
        rotation={transform.rotation}
        scale={transform.scale}
      >
        {child}
      </group>
      {/* </TransformControls> */}
    </EntityContextProvider>
  );
}
