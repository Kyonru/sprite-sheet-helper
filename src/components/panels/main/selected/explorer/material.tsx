import { MaterialsPanel } from "@/components/materials/material-workbench";
import { useModelsStore } from "@/store/next/models";
import { useEntitiesStore } from "@/store/next/entities";

export const MaterialContext = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const entities = useEntitiesStore((state) => state.entities);
  const models = useModelsStore((state) => state.models);

  const selectedModel = selected
    ? entities[selected]?.type === "model"
      ? selected
      : undefined
    : undefined;
  const selectedModelState = selectedModel ? models[selectedModel] : undefined;
  const fallbackModel = Object.values(entities)
    .map((entity) => entity.uuid)
    .find(
      (uuid) => entities[uuid]?.type === "model" && models[uuid]?.loadState === "loaded",
    );

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden">
      <MaterialsPanel
        initialModelUuid={selectedModelState?.loadState === "loaded" ? selected : fallbackModel}
        compact
      />
    </div>
  );
};
