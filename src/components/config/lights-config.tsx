import { useLightStore } from "@/store/lighting";
import { useModelStore } from "@/store/model";
import type {
  PointLight as PointLightType,
  SpotLight as SpotLightType,
} from "@/types/lighting";
import { folder, useControls } from "leva";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { TransformController } from "../transform-controller";
import { useHelper } from "@react-three/drei";
import { useEditorStore } from "@/store/editor";

const SpotLightObject = ({ light }: { light: SpotLightType }) => {
  const model = useModelStore((state) => state.ref);
  const showEditor = useEditorStore((state) => state.showEditor);

  const lightRef = useRef(null!);
  const helper = useHelper(lightRef, THREE.SpotLightHelper, light.color);

  useEffect(() => {
    if (!helper.current) {
      return;
    }
    if (showEditor) {
      helper.current.visible = true;
    } else {
      helper.current.visible = false;
    }
  }, [showEditor, helper]);

  useEffect(() => {
    if (!helper.current) {
      return;
    }
    helper.current.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light.color]);

  return (
    <TransformController position={light.position} mode={light.transform}>
      <spotLight
        ref={lightRef}
        angle={light.angle}
        penumbra={light.penumbra}
        decay={light.decay}
        intensity={light.intensity}
        distance={light.distance}
        color={light.color}
        power={light.power}
        castShadow={light.castShadow}
        target={model!}
      />
    </TransformController>
  );
};

export const PointLightObject = ({ light }: { light: PointLightType }) => {
  const showEditor = useEditorStore((state) => state.showEditor);

  const lightRef = useRef(null!);
  const helper = useHelper(
    lightRef,
    THREE.PointLightHelper,
    light.distance,
    light.color
  );

  useEffect(() => {
    if (!helper.current) {
      return;
    }
    if (showEditor) {
      helper.current.visible = true;
    } else {
      helper.current.visible = false;
    }
  }, [showEditor, helper]);

  useEffect(() => {
    if (!helper.current) {
      return;
    }

    helper.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light.distance, light.color]);

  return (
    <TransformController position={light.position}>
      <pointLight
        ref={lightRef}
        intensity={light.intensity}
        distance={light.distance}
        color={light.color}
        power={light.power}
        decay={light.decay}
      />
    </TransformController>
  );
};

export const Lighting = () => {
  const ambientLight = useLightStore((state) => state.ambientLight);
  const pointLights = useLightStore((state) => state.pointLights);
  const spotLights = useLightStore((state) => state.spotLights);

  return (
    <>
      {ambientLight.enabled && (
        <ambientLight
          intensity={ambientLight.intensity}
          color={ambientLight.color}
        />
      )}
      {pointLights.map((light, index) =>
        light.enabled ? <PointLightObject light={light} key={index} /> : null
      )}

      {spotLights.map((light, index) =>
        light.enabled ? <SpotLightObject light={light} key={index} /> : null
      )}
    </>
  );
};

const AmbientLight = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { type, ...ambientLightDefaults } = useLightStore(
    (state) => state.ambientLight
  );
  const setAmbientLight = useLightStore((state) => state.setAmbientLight);
  const { enabled, intensity, color } = useControls({
    lighting: folder(
      {
        ambient: folder(
          {
            ...ambientLightDefaults,
          },
          {
            collapsed: true,
          }
        ),
      },
      {
        collapsed: true,
      }
    ),
  });

  useEffect(() => {
    setAmbientLight({
      enabled,
      intensity,
      color,
    });
  }, [enabled, intensity, color, setAmbientLight]);

  return null;
};

const PointLight = ({
  index,
  light,
}: {
  index: number;
  light: PointLightType;
}) => {
  const setPointLight = useLightStore((state) => state.updatePointLight);
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type,
    ...pointLightDefaults
  } = light;

  const { enabled, intensity, color, decay, distance, position, power } =
    useControls({
      lighting: folder(
        {
          point: folder({
            [index + 1]: folder(
              {
                ...pointLightDefaults,
              },
              {
                collapsed: true,
              }
            ),
          }),
        },
        {
          collapsed: true,
        }
      ),
    });

  useEffect(() => {
    setPointLight(index, {
      enabled,
      intensity,
      color,
      decay,
      distance,
      position,
      power,
    });
  }, [
    enabled,
    intensity,
    color,
    decay,
    distance,
    position,
    power,
    setPointLight,
    index,
  ]);

  return null;
};

const PointLights = () => {
  const pointLights = useLightStore((state) => state.pointLights);
  const setPointLightsAmount = useLightStore(
    (state) => state.setPointLightsAmount
  );
  const { count } = useControls({
    lighting: folder(
      {
        point: folder(
          {
            count: {
              value: 0,
              step: 1,
              min: 0,
              max: 10,
            },
          },
          {
            collapsed: true,
          }
        ),
      },
      {
        collapsed: true,
      }
    ),
  });

  useEffect(() => {
    setPointLightsAmount(count);
  }, [count, setPointLightsAmount]);

  return (
    <>
      {pointLights.map((light, index) => (
        <PointLight key={index} index={index} light={light} />
      ))}
    </>
  );
};

const SportLight = ({
  index,
  light,
}: {
  index: number;
  light: SpotLightType;
}) => {
  const setSpotLight = useLightStore((state) => state.updateSpotLight);
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type,
    lookAtObject: lookAtObjectDefault,
    rotation: rotationDefault,
    transform: transformDefault,
    ...spotLightDefaults
  } = light;

  const {
    enabled,
    intensity,
    color,
    decay,
    distance,
    position,
    penumbra,
    power,
    angle,
    rotation,
    lookAtObject,
    transform,
  } = useControls(
    {
      lighting: folder(
        {
          spot: folder({
            [index + 1]: folder(
              {
                ...spotLightDefaults,
                penumbra: {
                  value: spotLightDefaults.penumbra,
                  min: 0,
                  max: 1,
                  step: 0.01,
                },
                lookAtObject: lookAtObjectDefault,
                rotation: {
                  value: rotationDefault,
                  step: 0.01,
                  editable: !lookAtObjectDefault,
                },
                transform: {
                  options: ["translate", "scale", "rotate"] as
                    | "translate"
                    | "scale"
                    | "rotate"[],
                  value: transformDefault!,
                },
              },
              {
                collapsed: true,
              }
            ),
          }),
        },
        {
          collapsed: true,
        }
      ),
    },
    [lookAtObjectDefault]
  );

  useEffect(() => {
    setSpotLight(index, {
      enabled,
      intensity,
      color,
      decay,
      distance,
      position,
      power,
      penumbra,
      angle,
      lookAtObject,
      rotation,
      transform: transform as "translate" | "scale" | "rotate",
    });
  }, [
    enabled,
    intensity,
    color,
    decay,
    distance,
    position,
    power,
    penumbra,
    angle,
    lookAtObject,
    rotation,
    setSpotLight,
    transform,
    index,
  ]);

  return null;
};

const SportLights = () => {
  const spotlights = useLightStore((state) => state.spotLights);
  const setSpotLightsAmount = useLightStore(
    (state) => state.setSpotLightsAmount
  );
  const { count } = useControls({
    lighting: folder(
      {
        spot: folder(
          {
            count: {
              value: 0,
              step: 1,
              min: 0,
              max: 10,
            },
          },
          {
            collapsed: true,
          }
        ),
      },
      {
        collapsed: true,
      }
    ),
  });

  useEffect(() => {
    setSpotLightsAmount(count);
  }, [count, setSpotLightsAmount]);

  return (
    <>
      {spotlights.map((light, index) => (
        <SportLight key={index} index={index} light={light} />
      ))}
    </>
  );
};

export const LightsConfig = () => {
  return (
    <>
      <AmbientLight />
      <PointLights />
      <SportLights />
    </>
  );
};
