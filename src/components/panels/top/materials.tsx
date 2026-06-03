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
import { PaletteIcon } from "lucide-react";

export const MaterialsMenu = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const entities = useEntitiesStore((state) => state.entities);
  const selectedModel =
    selected && entities[selected]?.type === "model" ? selected : undefined;
  const firstModel = Object.values(entities).find(
    (entity) => entity.type === "model",
  )?.uuid;
  const fallbackModel = selectedModel ?? firstModel;

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
            disabled={!selectedModel}
            onClick={() => selectedModel && openMaterialsWorkbench(selectedModel)}
          >
            Open for Selected Model
          </MenubarItem>
          <MenubarItem
            disabled={!fallbackModel}
            onClick={() => fallbackModel && openMaterialsWorkbench(fallbackModel)}
          >
            Open Materials Workbench
          </MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
