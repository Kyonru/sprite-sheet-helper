import { useEntitiesStore } from "@/store/next/entities";
import { useHistoryStore } from "@/store/next/history";
import { useModelsStore } from "@/store/next/models";
import { useTransformsStore } from "@/store/next/transforms";
import type { Transform } from "@/types/ecs";
import type { HistoryAction } from "@/types/history";
import { toast } from "sonner";

export const useAddModel = (select = true) => {
  const addEntity = useEntitiesStore((state) => state.addEntity);
  const selectEntity = useEntitiesStore((state) => state.selectEntity);
  const unselectEntity = useEntitiesStore((state) => state.unselectEntity);
  const removeEntity = useEntitiesStore((state) => state.removeEntity);
  const loadModel = useModelsStore((state) => state.loadFromFile);
  const removeModel = useModelsStore((state) => state.removeModel);
  const initTransform = useTransformsStore((state) => state.initTransform);
  const removeTransform = useTransformsStore((state) => state.removeTransform);
  const pushBatch = useHistoryStore((state) => state.pushBatch);

  const initialTransform: Transform = {
    position: [0, 0.8, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  return async (file: File, name?: string) => {
    let uuid: string | undefined;

    const rollback = () => {
      if (!uuid) return;

      const selectedModel = useEntitiesStore.getState().selected;
      if (selectedModel === uuid) {
        unselectEntity();
      }

      removeModel(uuid);
      removeTransform(uuid);
      removeEntity(uuid);
    };

    try {
      const label = name ?? file.name ?? "Model";
      uuid = addEntity("model", label);

      initTransform(uuid, {
        position: initialTransform.position,
      });

      await loadModel(uuid, file);

      if (select) {
        selectEntity(uuid);
      }

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
            if (!uuid) {
              return;
            }
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
            position: initialTransform.position,
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          apply: ({ dir }) => {
            if (!uuid) {
              return;
            }
            if (dir === "forward") {
              useTransformsStore.getState().initTransform(uuid, {
                position: initialTransform.position,
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
      rollback();
      toast.error(`Failed to load model: ${(e as Error).message || e}`);
    }
  };
};
