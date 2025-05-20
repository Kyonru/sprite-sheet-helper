import { useCameraStore } from "@/store/camera.";
import type { CameraType } from "@/types/camera";
import { folder, useControls } from "leva";
import { useEffect } from "react";

export const useCameraValues = () => {
  const positionDefault = useCameraStore((state) => state.position);
  const zoomDefault = useCameraStore((state) => state.zoom);
  const fovDefault = useCameraStore((state) => state.fov);
  const typeDefault = useCameraStore((state) => state.type);
  const setPosition = useCameraStore((state) => state.setPosition);
  const setZoom = useCameraStore((state) => state.setZoom);
  const setFov = useCameraStore((state) => state.setFov);
  const setType = useCameraStore((state) => state.setType);

  const { position, zoom, fov, type } = useControls({
    camera: folder(
      {
        position: positionDefault,
        zoom: zoomDefault,
        fov: fovDefault,
        type: {
          options: ["orthographic", "perspective"] as CameraType[],
          value: typeDefault,
        },
      },
      {
        collapsed: true,
      }
    ),
  });

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

  return {
    position,
    zoom,
    fov,
    type,
  };
};
