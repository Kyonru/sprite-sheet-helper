import { useEntitiesStore, useEntity } from "@/store/next/entities";
import { useLight } from "@/store/next/lights";
import type {
  AmbientLightComponent,
  DirectionalLightComponent,
  PointLightComponent,
  SpotLightComponent,
} from "@/types/ecs";
import { useHelper } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { LAYERS } from "../panels/scene/constants";

const PointLightObject = ({
  light,
  uuid,
}: {
  light: PointLightComponent;
  uuid: string;
}) => {
  const lightRef = useRef<THREE.PointLight>(null!);
  const selected = useEntitiesStore((state) => state.selected);

  const helper = useHelper(
    lightRef,
    THREE.PointLightHelper,
    light.distance,
    light.color,
  );

  useEffect(() => {
    if (!helper.current) return;
    helper.current.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    helper.current.visible = selected === uuid;
    helper.current.update();
  }, [light.distance, light.color, selected, uuid, helper]);

  return (
    <pointLight
      ref={lightRef}
      intensity={light.intensity}
      distance={light.distance}
      decay={light.decay}
      color={light.color}
      power={light.power}
    />
  );
};

const SpotLightObject = ({
  light,
  uuid,
}: {
  light: SpotLightComponent;
  uuid: string;
}) => {
  const lightRef = useRef<THREE.SpotLight>(null!);
  const selected = useEntitiesStore((state) => state.selected);

  const helper = useHelper(lightRef, THREE.SpotLightHelper, light.color);

  useEffect(() => {
    if (!helper.current) return;
    helper.current.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    helper.current.visible = selected === uuid;
    helper.current.update();
  }, [light.color, selected, uuid, helper]);

  return (
    <spotLight
      ref={lightRef}
      angle={light.angle}
      penumbra={light.penumbra}
      intensity={light.intensity}
      distance={light.distance}
      decay={light.decay}
      color={light.color}
      power={light.power}
    />
  );
};

const DirectionalLightObject = ({
  light,
  uuid,
}: {
  uuid: string;
  light: DirectionalLightComponent;
}) => {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const selected = useEntitiesStore((state) => state.selected);

  const helper = useHelper(
    lightRef,
    THREE.DirectionalLightHelper,
    10,
    light.color,
  );

  useEffect(() => {
    if (!helper.current) return;
    helper.current.layers.set(LAYERS.LAYER_EDITOR_ONLY);
    helper.current.visible = selected === uuid;
    helper.current.update();
  }, [light.color, selected, uuid, helper]);

  return (
    <directionalLight
      ref={lightRef}
      intensity={light.intensity}
      color={light.color}
    />
  );
};

const AmbientLightObject = ({ light }: { light: AmbientLightComponent }) => {
  return <ambientLight intensity={light.intensity} color={light.color} />;
};

export function LightComponent({ uuid }: { uuid: string }) {
  const entity = useEntity(uuid);
  const lightObject = useLight(uuid);

  if (!entity || !lightObject) return null;

  if (entity.metadata.type === "ambient") {
    const light: AmbientLightComponent = lightObject as AmbientLightComponent;
    return <AmbientLightObject light={light} />;
  }

  if (entity.metadata.type === "directional") {
    const light: DirectionalLightComponent =
      lightObject as DirectionalLightComponent;
    return <DirectionalLightObject uuid={uuid} light={light} />;
  }

  if (entity.metadata.type === "point") {
    const light: PointLightComponent = lightObject as PointLightComponent;
    return <PointLightObject uuid={uuid} light={light} />;
  }

  if (entity.metadata.type === "spot") {
    const light: SpotLightComponent = lightObject as SpotLightComponent;
    return <SpotLightObject uuid={uuid} light={light} />;
  }

  return null;
}
