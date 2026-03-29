import { useEntitiesStore } from "@/store/next/entities";
import { useHistoryStore } from "@/store/next/history";
import { useLightsStore } from "@/store/next/lights";
import { useTargetsStore } from "@/store/next/targets";
import { useTransformsStore } from "@/store/next/transforms";
import type { LightType } from "@/types/ecs";
import { capitalize } from "@/utils/strings";

export const useAddLight = (select = true) => {
  const addEntity = useEntitiesStore((state) => state.addEntity);
  const selectEntity = useEntitiesStore((state) => state.selectEntity);
  const initLight = useLightsStore((state) => state.initLight);
  const initTransform = useTransformsStore((state) => state.initTransform);
  const push = useHistoryStore((state) => state.push);
  const initTarget = useTargetsStore((state) => state.initTarget);

  return (type: LightType, name?: string) => {
    const label = name ?? capitalize(`${type} light`, true);
    const uuid = addEntity("light", label, {
      type,
    });
    initLight(uuid, type);
    initTransform(uuid, {
      position: [0, 2.5, 2.5],
    });

    if (type !== "ambient" && type !== "point") {
      initTarget(uuid);
    }

    if (select) {
      selectEntity(uuid);
    }

    push({
      type: "entity/add",
      uuid,
      entity: useEntitiesStore.getState().entities[uuid],
    });

    return uuid;
  };
};
