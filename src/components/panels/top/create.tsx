import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { openAssetToybox } from "@/components/asset-toybox/controller";
import { useCreateAuthoredModel } from "@/hooks/next/use-create-authored-model";
import { useAuthoredModelsStore } from "@/store/next/authored-models";
import { useEntitiesStore } from "@/store/next/entities";
import { useModelsStore } from "@/store/next/models";
import { BoxIcon } from "lucide-react";

export function CreateMenu() {
  const createAuthoredModel = useCreateAuthoredModel();
  const selected = useEntitiesStore((state) => state.selected);
  const selectedModel = useModelsStore((state) =>
    selected ? state.models[selected] : undefined,
  );
  const selectedRecipe = selectedModel?.authoredModelId;
  const fallbackRecipe = useAuthoredModelsStore(
    (state) => state.selectedRecipeId ?? Object.keys(state.recipes)[0],
  );

  return (
    <MenubarMenu>
      <MenubarTrigger>
        <BoxIcon className="size-4" />
      </MenubarTrigger>
      <MenubarContent className="z-999">
        <MenubarGroup>
          <MenubarItem disabled className="text-xs text-muted-foreground">
            Create
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem onClick={() => createAuthoredModel()}>
            New Skeleton Character
          </MenubarItem>
          <MenubarItem
            onClick={() => createAuthoredModel("Primitive Asset", "primitive")}
          >
            New Primitive Asset
          </MenubarItem>
          <MenubarItem
            disabled={!selectedRecipe && !fallbackRecipe}
            onClick={() => openAssetToybox(selectedRecipe ?? fallbackRecipe)}
          >
            Open Asset Toybox
          </MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}
