import React, { useEffect, useRef } from "react";
import { useEntitiesStore } from "@/store/next/entities";
import { useTransform, useTransformsStore } from "@/store/next/transforms";
import { Text, TransformControls } from "@react-three/drei";
import { LightComponent } from "@/components/object/lights";
import { useEntityContext } from "@/context/next/entity-context";
import { ModelComponent } from "./object/model";
import * as THREE from "three";
import { useModelObject, useModelsStore } from "@/store/next/models";
import { LAYERS } from "./panels/scene/constants";
import { useTarget, useTargetsStore } from "@/store/next/targets";
import { useFrame } from "@react-three/fiber";
import { isDifferent } from "@/utils/vector";
import { toast } from "sonner";
import { clearRuntimeModel } from "@/utils/model-downgrade-runtime";

function ObjectTarget({
  uuid,
  visible = true,
}: {
  uuid: string;
  visible?: boolean;
}) {
  const target = useTarget(uuid);
  const setTarget = useTargetsStore((state) => state.setTarget);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null!);
  const selected = useEntitiesStore((state) => state.selected);

  const isSelected = selected === uuid;
  const { isPreview } = useEntityContext();
  const isInteractive = isSelected && visible && !isPreview;

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

    if (
      isDifferent(target, [
        object.position.x,
        object.position.y,
        object.position.z,
      ])
    ) {
      setTarget(uuid, [
        object.position.x,
        object.position.y,
        object.position.z,
      ]);
    }
  });

  if (!target) return null;

  return (
    <>
      <TransformControls
        enabled={isInteractive}
        showX={isInteractive}
        showY={isInteractive}
        showZ={isInteractive}
        ref={controlsRef}
        mode={"translate"}
        position={target}
        onMouseUp={() => {
          if (!controlsRef.current) return;
          const object = controlsRef.current.object;

          setTarget(uuid, [
            object.position.x,
            object.position.y,
            object.position.z,
          ]);
        }}
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
        visible={isInteractive}
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
  const isVisible = entity.visible !== false;

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
    child = (
      <ModelRenderErrorBoundary uuid={uuid}>
        <ModelComponent uuid={uuid} />
      </ModelRenderErrorBoundary>
    );
  }

  const isSelected = selected === uuid;

  return (
    <>
      <TransformControls
        enabled={isSelected && !isPreview && isVisible}
        showX={isSelected && !isPreview && isVisible}
        showY={isSelected && !isPreview && isVisible}
        showZ={isSelected && !isPreview && isVisible}
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
      <ObjectTarget uuid={uuid} visible={isVisible} />
      <group
        ref={groupRef}
        position={transform.position}
        rotation={transform.rotation}
        scale={transform.scale}
        visible={isVisible}
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
          visible={!isPreview && selected === uuid && isVisible}
        >
          {entity.name ?? entity.type}
        </Text>
      </group>
      {/* </TransformControls> */}
    </>
  );
}

type ModelRenderErrorBoundaryProps = {
  children: React.ReactNode;
  uuid: string;
};

type ModelRenderErrorBoundaryState = {
  hasError: boolean;
};

class ModelRenderErrorBoundary extends React.Component<
  ModelRenderErrorBoundaryProps,
  ModelRenderErrorBoundaryState
> {
  state: ModelRenderErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const message =
      error instanceof Error ? error.message : "Unknown model render error";
    const { setLoadState, setMixerRef } = useModelsStore.getState();

    setLoadState(this.props.uuid, "error", message);
    setMixerRef(this.props.uuid, null);
    clearRuntimeModel(this.props.uuid);
    toast.error(`Failed to render model`, {
      description: `${this.props.uuid}: ${message}`,
    });
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
