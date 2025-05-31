import { useLightStore } from "@/store/lighting";
import { useModelStore } from "@/store/model";
import type {
  PointLight as PointLightType,
  SpotLight as SpotLightType,
} from "@/types/lighting";
import { folder, useControls } from "leva";
import { useEffect } from "react";

export const Lighting = () => {
  const ambientLight = useLightStore((state) => state.ambientLight);
  const pointLights = useLightStore((state) => state.pointLights);
  const spotLights = useLightStore((state) => state.spotLights);
  const modelPosition = useModelStore((state) => state.position);

  return (
    <>
      {ambientLight.enabled && (
        <ambientLight
          intensity={ambientLight.intensity}
          color={ambientLight.color}
        />
      )}
      {pointLights.map((light, index) =>
        light.enabled ? (
          <pointLight
            key={index}
            position={light.position}
            decay={light.decay}
            intensity={light.intensity}
            distance={light.distance}
            color={light.color}
            lookAt={modelPosition}
            power={light.power}
          />
        ) : null
      )}

      {spotLights.map((light, index) =>
        light.enabled ? (
          <spotLight
            key={index}
            position={light.position}
            angle={light.angle}
            penumbra={light.penumbra}
            decay={light.decay}
            intensity={light.intensity}
            distance={light.distance}
            color={light.color}
            power={light.power}
            castShadow={light.castShadow}
            lookAt={modelPosition}
          />
        ) : null
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { type, ...pointLightDefaults } = light;

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { type, ...pointLightDefaults } = light;

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
  } = useControls({
    lighting: folder(
      {
        spot: folder({
          [index + 1]: folder(
            {
              ...pointLightDefaults,
              penumbra: {
                value: pointLightDefaults.penumbra,
                min: 0,
                max: 1,
                step: 0.01,
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
  });

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
    setSpotLight,
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
