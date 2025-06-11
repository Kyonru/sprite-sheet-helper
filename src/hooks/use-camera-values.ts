import { useCameraStore } from "@/store/camera";

export const useCameraValues = () => {
  const position = useCameraStore((state) => state.position);
  const rotation = useCameraStore((state) => state.rotation);
  const scale = useCameraStore((state) => state.scale);
  const zoom = useCameraStore((state) => state.zoom);
  const fov = useCameraStore((state) => state.fov);
  const type = useCameraStore((state) => state.type);
  const setPosition = useCameraStore((state) => state.setPosition);
  const setRotation = useCameraStore((state) => state.setRotation);
  const setScale = useCameraStore((state) => state.setScale);
  const setZoom = useCameraStore((state) => state.setZoom);
  const useGesturesControls = useCameraStore(
    (state) => state.useGesturesControls
  );

  return {
    useGesturesControls,
    position,
    rotation,
    scale,
    zoom,
    fov,
    type,
    setPosition,
    setRotation,
    setScale,
    setZoom,
  };
};
