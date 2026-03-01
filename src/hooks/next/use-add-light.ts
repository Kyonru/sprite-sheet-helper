import { useEntitiesStore } from "@/store/next/entities";
import { useHistoryStore } from "@/store/next/history";
import { useLightsStore } from "@/store/next/lights";
import { useTransformsStore } from "@/store/next/transforms";
import type { LightType } from "@/types/ecs";

export const useAddLight = () => {
  const addEntity = useEntitiesStore((state) => state.addEntity);
  const initLight = useLightsStore((state) => state.initLight);
  const initTransform = useTransformsStore((state) => state.initTransform);
  const push = useHistoryStore((state) => state.push);

  return (type: LightType, name?: string) => {
    const uuid = addEntity("light", name ?? `${type} light`, {
      type,
    });
    initLight(uuid, type);
    initTransform(uuid);

    push({
      type: "entity/add",
      uuid,
      entity: useEntitiesStore.getState().entities[uuid],
    });

    return uuid;
  };
};
