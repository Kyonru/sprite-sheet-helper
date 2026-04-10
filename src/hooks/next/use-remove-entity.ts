import { useEntitiesStore } from "@/store/next/entities";
import { useLightsStore } from "@/store/next/lights";
import { useModelsStore } from "@/store/next/models";
import { useTargetsStore } from "@/store/next/targets";
import { useTransformsStore } from "@/store/next/transforms";

export const useRemoveEntity = () => {
  const removeEntity = useEntitiesStore((state) => state.removeEntity);
  const selected = useEntitiesStore((state) => state.selected);
  const unselectEntity = useEntitiesStore((state) => state.unselectEntity);
  const removeLight = useLightsStore((state) => state.removeLight);
  const removeTransform = useTransformsStore((state) => state.removeTransform);
  const removeTarget = useTargetsStore((state) => state.removeTarget);
  const removeModel = useModelsStore((state) => state.removeModel);

  return (uuid: string) => {
    removeEntity(uuid);
    if (selected === uuid) {
      unselectEntity();
    }
    removeLight(uuid);
    removeTransform(uuid);
    removeTarget(uuid);
    removeModel(uuid);
  };
};
