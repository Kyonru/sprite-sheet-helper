import { useEntitiesStore } from "@/store/next/entities";
import { useHistoryStore } from "@/store/next/history";
import { useModelsStore } from "@/store/next/models";
import { useTransformsStore } from "@/store/next/transforms";
import type { HistoryAction } from "@/types/history";
import { toast } from "sonner";

export const useAddModel = (select = true) => {
  const addEntity = useEntitiesStore((state) => state.addEntity);
  const selectEntity = useEntitiesStore((state) => state.selectEntity);
  const loadModel = useModelsStore((state) => state.loadFromFile);
  const initTransform = useTransformsStore((state) => state.initTransform);
  const pushBatch = useHistoryStore((state) => state.pushBatch);

  return async (file: File, name?: string) => {
    try {
      const label = name ?? file.name ?? "Model";
      const uuid = addEntity("model", label);

      initTransform(uuid);
      await loadModel(uuid, file);

      if (select) {
        selectEntity(uuid);
      }

      // push({
      //   type: "entity/add",
      //   uuid,
      //   entity: useEntitiesStore.getState().entities[uuid],
      // });

      const entity = structuredClone(
        useEntitiesStore.getState().entities[uuid],
      );

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
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          apply: ({ dir }) => {
            if (dir === "forward") {
              useTransformsStore.getState().initTransform(uuid, {
                position: [0, 0, 0],
              });
            } else {
              useTransformsStore.getState().removeTransform(uuid);
            }
          },
        },
      ];

      pushBatch(`Add model ${entity.name}`, actions);

      return uuid;
    } catch (e) {
      toast.error(`Failed to load model: ${(e as Error).message}`);
    }
  };
};
