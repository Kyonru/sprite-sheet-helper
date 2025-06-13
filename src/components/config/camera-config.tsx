import { useCameraStore } from "@/store/camera";
import { useModelStore } from "@/store/model";
import type { CameraType } from "@/types/camera";
import { button, folder, useControls } from "leva";
import { useEffect } from "react";

export const CameraConfig = () => {
  const positionDefault = useCameraStore((state) => state.position);
  const rotationDefault = useCameraStore((state) => state.rotation);
  const scaleDefault = useCameraStore((state) => state.scale);
  const zoomDefault = useCameraStore((state) => state.zoom);
  const fovDefault = useCameraStore((state) => state.fov);
  const typeDefault = useCameraStore((state) => state.type);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { target0, ...orbitSettingsDefault } = useCameraStore(
    (state) => state.orbitSettings
  );
  const useGesturesControlsDefault = useCameraStore(
    (state) => state.useGesturesControls
  );
  const setUseGesturesControls = useCameraStore(
    (state) => state.setUseGesturesControls
  );
  const setUIStateFunction = useCameraStore(
    (state) => state.setUIStateFunction
  );
  const setPosition = useCameraStore((state) => state.setPosition);
  const setRotation = useCameraStore((state) => state.setRotation);
  const setScale = useCameraStore((state) => state.setScale);
  const setZoom = useCameraStore((state) => state.setZoom);
  const setFov = useCameraStore((state) => state.setFov);
  const setType = useCameraStore((state) => state.setType);
  const updateOrbitSettings = useCameraStore(
    (state) => state.updateOrbitSettings
  );
  const orbitRef = useCameraStore((state) => state.orbitRef);
  const modelRef = useModelStore((state) => state.ref);

  const [
    { position, rotation, scale, zoom, fov, type, useGesturesControls },
    set,
  ] = useControls(() => ({
    camera: folder(
      {
        position: positionDefault,
        rotation: rotationDefault,
        scale: scaleDefault,
        zoom: zoomDefault,
        useGesturesControls: useGesturesControlsDefault,
        fov: {
          min: 0,
          max: 180,
          step: 1,
          value: fovDefault,
        },
        type: {
          options: ["orthographic", "perspective"] as CameraType[],
          value: typeDefault,
        },
      },
      {
        collapsed: true,
      }
    ),
  }));

  const orbit = useControls(
    {
      camera: folder(
        {
          "orbit settings": folder(
            {
              ...orbitSettingsDefault,
              focus: button(() => {
                if (!orbitRef || !modelRef) return;
                orbitRef.target.set(
                  modelRef.position.x,
                  modelRef.position.y,
                  modelRef.position.z
                );
              }),
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
    },
    [modelRef, orbitRef]
  );

  useEffect(() => {
    setPosition(position);
  }, [position, setPosition]);

  useEffect(() => {
    setZoom(zoom);
  }, [zoom, setZoom]);

  useEffect(() => {
    setFov(fov);
  }, [fov, setFov]);

  useEffect(() => {
    setType(type);
  }, [type, setType]);

  useEffect(() => {
    setRotation(rotation);
  }, [rotation, setRotation]);

  useEffect(() => {
    setScale(scale);
  }, [scale, setScale]);

  useEffect(() => {
    setUseGesturesControls(useGesturesControls);
  }, [useGesturesControls, setUseGesturesControls]);

  useEffect(() => {
    setUIStateFunction(set as unknown as <T>(uiState: T) => void);
  }, [setUIStateFunction, set]);

  useEffect(() => {
    updateOrbitSettings(orbit);
  }, [orbit, updateOrbitSettings]);

  return null;
};
