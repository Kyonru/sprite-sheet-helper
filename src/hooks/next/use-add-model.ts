import { useEntitiesStore } from "@/store/next/entities";
import { useModelsStore } from "@/store/next/models";
import { useTransformsStore } from "@/store/next/transforms";

export const useAddModel = (select = true) => {
  const addEntity = useEntitiesStore((state) => state.addEntity);
  const selectEntity = useEntitiesStore((state) => state.selectEntity);
  const loadModel = useModelsStore((state) => state.loadFromFile);
  const initTransform = useTransformsStore((state) => state.initTransform);
  // const push = useHistoryStore((state) => state.push);

  return (file: File, name?: string) => {
    const label = name ?? file.name ?? "Model";
    const uuid = addEntity("model", label);

    console.log(file, name);

    initTransform(uuid);
    loadModel(uuid, file);

    if (select) {
      selectEntity(uuid);
    }

    // push({
    //   type: "entity/add",
    //   uuid,
    //   entity: useEntitiesStore.getState().entities[uuid],
    // });

    return uuid;
  };
};
