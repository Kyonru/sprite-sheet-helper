import { useRef } from "react";
import { useEntitiesStore } from "@/store/next/entities";
import { useTransform, useTransformsStore } from "@/store/next/transforms";
import { TransformControls } from "@react-three/drei";
import { LightComponent } from "@/components/lights/base";
import { EntityContextProvider } from "@/context/next/entity-context";

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

  if (!entity || !transform) return null;

  let child = <></>;
  if (entity.type === "light") {
    child = <LightComponent uuid={uuid} />;
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
          if (!controlsRef.current?.object) return;
          const object = controlsRef.current.object;
          setTransform(uuid, {
            position: [object.position.x, object.position.y, object.position.z],
            rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
            scale: [object.scale.x, object.scale.y, object.scale.z],
          });
        }}
        position={transform.position}
        rotation={transform.rotation}
        scale={transform.scale}
      >
        {child}
      </TransformControls>
    </EntityContextProvider>
  );
}
