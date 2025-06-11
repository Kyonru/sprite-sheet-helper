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
import { TransformControls, useHelper } from "@react-three/drei";
import { useEditorStore } from "@/store/editor";
import { TRANSFORM_OPTIONS } from "@/constants/objects";

const SpotLightObject = ({
  light,
  id,
}: {
  light: SpotLightType;
  id: number;
}) => {
  const model = useModelStore((state) => state.ref);
  const showEditor = useEditorStore((state) => state.showEditor);
  const setUIState = useLightStore((state) => state.spotLightsUIState[id]);

  const lightRef = useRef<THREE.SpotLight>(null!);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directionTransformRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformRef = useRef<any>(null);
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

  useEffect(() => {
    if (!lightRef.current) return;

    const diff = model?.uuid !== lightRef.current.target?.uuid;

    if (light.lookAtObject && model && diff) {
      lightRef.current.target = model;

      setUIState({
        direction: [model.position.x, model.position.y, model.position.z],
      });
    }

    if (!light.lookAtObject) {
      lightRef.current.target = directionTransformRef.current?.object;
      setUIState({
        direction: [
          directionTransformRef.current?.object.position.x,
          directionTransformRef.current?.object.position.y,
          directionTransformRef.current?.object.position.z,
        ],
      });
    }
  }, [light.lookAtObject, model, setUIState]);

  return (
    <>
      <TransformController
        ref={transformRef}
        onMouseUp={() => {
          if (!transformRef.current?.object) return;

          setUIState({
            position: [
              transformRef.current.object.position.x,
              transformRef.current.object.position.y,
              transformRef.current.object.position.z,
            ],
            rotation: [
              transformRef.current.object.rotation.x,
              transformRef.current.object.rotation.y,
              transformRef.current.object.rotation.z,
            ],
          });
        }}
        position={light.position}
        mode={light.transform}
      >
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
        />
      </TransformController>
      <TransformControls
        ref={directionTransformRef}
        showX={!light.lookAtObject}
        showY={!light.lookAtObject}
        showZ={!light.lookAtObject}
        onMouseUp={() => {
          if (
            !directionTransformRef.current?.object ||
            !lightRef.current ||
            light.lookAtObject
          ) {
            return;
          }

          const object = directionTransformRef.current.object;

          lightRef.current.target = object;

          setUIState({
            direction: [
              object.position.x,
              object.position.y,
              object.position.z,
            ],
          });
        }}
        position={light.direction}
        mode={"translate"}
      />
    </>
  );
};

export const PointLightObject = ({
  light,
  id,
}: {
  light: PointLightType;
  id: number;
}) => {
  const showEditor = useEditorStore((state) => state.showEditor);
  const setUIState = useLightStore((state) => state.pointLightsUIState[id]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformRef = useRef<any>(null);

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
    <TransformController
      ref={transformRef}
      onMouseUp={() => {
        if (!transformRef.current?.object) return;
        const object = transformRef.current.object;
        setUIState({
          position: [object.position.x, object.position.y, object.position.z],
        });
      }}
      position={light.position}
    >
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
        light.enabled ? (
          <PointLightObject id={index} light={light} key={index} />
        ) : null
      )}

      {spotLights.map((light, index) =>
        light.enabled ? (
          <SpotLightObject id={index} light={light} key={index} />
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
  const setUIStateFunction = useLightStore(
    (state) => state.setPointLightsUIStateFunction
  );
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type,
    ...pointLightDefaults
  } = light;

  const [props, set] = useControls(() => ({
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
  }));

  useEffect(() => {
    setPointLight(index, props);
  }, [props, setPointLight, index]);

  useEffect(() => {
    setUIStateFunction(index, set as unknown as <T>(uiState: T) => void);
  }, [setUIStateFunction, index, set]);

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
  const setUIStateFunction = useLightStore(
    (state) => state.setSpotLightsUIStateFunction
  );
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type,
    lookAtObject: lookAtObjectDefault,
    rotation: rotationDefault,
    transform: transformDefault,
    ...spotLightDefaults
  } = light;

  const [props, set] = useControls(
    () => ({
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
                  options: TRANSFORM_OPTIONS,
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
    }),
    [lookAtObjectDefault]
  );

  useEffect(() => {
    setSpotLight(index, props);
  }, [props, setSpotLight, index]);

  useEffect(() => {
    setUIStateFunction(index, set as unknown as <T>(uiState: T) => void);
  }, [setUIStateFunction, index, set]);

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
