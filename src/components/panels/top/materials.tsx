import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { openMaterialsWorkbench } from "@/components/materials/material-workbench";
import { useEntitiesStore } from "@/store/next/entities";
import { useModelsStore } from "@/store/next/models";
import { PaletteIcon } from "lucide-react";

export const MaterialsMenu = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const entities = useEntitiesStore((state) => state.entities);
  const models = useModelsStore((state) => state.models);
  const selectedModel =
    selected && entities[selected]?.type === "model" ? selected : undefined;
  const selectedLoadedModel =
    selectedModel && models[selectedModel]?.loadState === "loaded"
      ? selectedModel
      : undefined;
  const firstLoadedModel = Object.values(entities).find(
    (entity) =>
      entity.type === "model" && models[entity.uuid]?.loadState === "loaded",
  )?.uuid;
  const fallbackLoadedModel = selectedLoadedModel ?? firstLoadedModel;

  return (
    <MenubarMenu>
      <MenubarTrigger>
        <PaletteIcon className="size-4" />
      </MenubarTrigger>
      <MenubarContent className="z-999">
        <MenubarGroup>
          <MenubarItem disabled className="text-xs text-muted-foreground">
            Materials
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem
            disabled={!selectedLoadedModel}
            onClick={() =>
              selectedLoadedModel && openMaterialsWorkbench(selectedLoadedModel)
            }
          >
            Open for Selected Model
          </MenubarItem>
          <MenubarItem
            disabled={!fallbackLoadedModel}
            onClick={() =>
              fallbackLoadedModel && openMaterialsWorkbench(fallbackLoadedModel)
            }
          >
            Open Materials Workbench
          </MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
