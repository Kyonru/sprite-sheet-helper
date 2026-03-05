import { useCamerasStore } from "@/store/next/cameras";
import { useEntitiesStore } from "@/store/next/entities";
import { useTransformsStore } from "@/store/next/transforms";

export const useAddCamera = () => {
  const addEntity = useEntitiesStore((state) => state.addEntity);
  const initCamera = useCamerasStore((state) => state.initCamera);
  const initTransform = useTransformsStore((state) => state.initTransform);

  return () => {
    const uuid = addEntity("camera", "Main Camera");
    initCamera(uuid);
    initTransform(uuid);

    return uuid;
  };
};
