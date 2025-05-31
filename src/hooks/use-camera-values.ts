import { useCameraStore } from "@/store/camera.";

export const useCameraValues = () => {
  const position = useCameraStore((state) => state.position);
  const zoom = useCameraStore((state) => state.zoom);
  const fov = useCameraStore((state) => state.fov);
  const type = useCameraStore((state) => state.type);

  return {
    position,
    zoom,
    fov,
    type,
  };
};
