import { openAssetToybox } from "@/components/asset-toybox/controller";
import { useAuthoredModelsStore } from "@/store/next/authored-models";
import { useEntitiesStore } from "@/store/next/entities";
import { useModelsStore } from "@/store/next/models";
import { useTransformsStore } from "@/store/next/transforms";

export function useCreateAuthoredModel() {
  const addEntity = useEntitiesStore((state) => state.addEntity);
  const selectEntity = useEntitiesStore((state) => state.selectEntity);
  const initTransform = useTransformsStore((state) => state.initTransform);
  const createAuthoredModel = useModelsStore(
    (state) => state.createAuthoredModel,
  );
  const createHumanoidRecipe = useAuthoredModelsStore(
    (state) => state.createHumanoidRecipe,
  );
  const createPrimitiveRecipe = useAuthoredModelsStore(
    (state) => state.createPrimitiveRecipe,
  );

  return (
    name = "Skeleton Character",
    kind: "skeleton" | "primitive" = "skeleton",
  ) => {
    const authoredModelId =
      kind === "primitive"
        ? createPrimitiveRecipe(name, "box")
        : createHumanoidRecipe(name);
    const uuid = addEntity("model", name, {
      source: "authored",
      authoredModelId,
    });
    initTransform(uuid, { position: [0, 0.35, 0] });
    createAuthoredModel(uuid, authoredModelId, name);
    selectEntity(uuid);
    openAssetToybox(authoredModelId);
    return uuid;
  };
}
