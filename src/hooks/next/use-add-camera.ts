import { useCamerasStore } from "@/store/next/cameras";
import { useEntitiesStore } from "@/store/next/entities";
import { useTransformsStore } from "@/store/next/transforms";
import type { Transform } from "@/types/ecs";

export const useAddCamera = (isMain = false) => {
  const addEntity = useEntitiesStore((state) => state.addEntity);
  const initCamera = useCamerasStore((state) => state.initCamera);
  const setActiveCamera = useCamerasStore((state) => state.setActiveCamera);
  const initTransform = useTransformsStore((state) => state.initTransform);

  return (transform?: Partial<Transform>) => {
    const uuid = addEntity("camera", "Main Camera");
    initCamera(uuid);
    initTransform(uuid, transform);
    if (isMain) {
      setActiveCamera(uuid);
    }

    return uuid;
  };
};
