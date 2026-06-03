import { MaterialsPanel } from "@/components/materials/material-workbench";
import { useEntitiesStore } from "@/store/next/entities";

export const MaterialContext = () => {
  const selected = useEntitiesStore((state) => state.selected);
  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden">
      <MaterialsPanel initialModelUuid={selected} compact />
    </div>
  );
};
