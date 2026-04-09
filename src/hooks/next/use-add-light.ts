import { useEntitiesStore } from "@/store/next/entities";
import { useHistoryStore } from "@/store/next/history";
import { useLightsStore } from "@/store/next/lights";
import { useTargetsStore } from "@/store/next/targets";
import { useTransformsStore } from "@/store/next/transforms";
import type { LightType } from "@/types/ecs";
import type { HistoryAction } from "@/types/history";
import { capitalize } from "@/utils/strings";

export const useAddLight = (select = true) => {
  const addEntity = useEntitiesStore((state) => state.addEntity);
  const selectEntity = useEntitiesStore((state) => state.selectEntity);
  const initLight = useLightsStore((state) => state.initLight);
  const initTransform = useTransformsStore((state) => state.initTransform);
  const pushBatch = useHistoryStore((state) => state.pushBatch);
  const initTarget = useTargetsStore((state) => state.initTarget);

  return (type: LightType, name?: string) => {
    const label = name ?? capitalize(`${type} light`, true);
    const uuid = addEntity("light", label, {
      type,
    });
    const position: [number, number, number] = [0, 2.5, 2.5];
    initLight(uuid, type);
    initTransform(uuid, {
      position: position,
    });

    if (type !== "ambient" && type !== "point") {
      initTarget(uuid);
    }

    if (select) {
      selectEntity(uuid);
    }

    const entity = structuredClone(useEntitiesStore.getState().entities[uuid]);

    const actions: HistoryAction[] = [
      {
        type: "entity/add",
        uuid,
        from: null,
        to: entity,
        apply: ({ dir }) => {
          if (dir === "forward") {
            useEntitiesStore.getState().restoreEntity(entity);
          } else {
            useEntitiesStore.getState().removeEntity(uuid);
          }
        },
      },
      {
        type: "transform/init",
        uuid,
        from: null,
        to: {
          position,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        apply: ({ dir }) => {
          if (dir === "forward") {
            useTransformsStore.getState().initTransform(uuid, {
              position: position,
            });
          } else {
            useTransformsStore.getState().removeTransform(uuid);
          }
        },
      },
    ];

    // optional target
    if (type !== "ambient" && type !== "point") {
      const target: [number, number, number] = [0, 0, 0];
      actions.push({
        type: "target/init",
        uuid,
        from: null,
        to: target,
        apply: ({ dir }) => {
          if (dir === "forward") {
            useTargetsStore.getState().initTarget(uuid, target);
          } else {
            useTargetsStore.getState().removeTarget(uuid);
          }
        },
      });
    }

    pushBatch(`Add light ${entity.metadata?.type}`, actions);

    return uuid;
  };
};
