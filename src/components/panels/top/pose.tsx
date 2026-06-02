import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { openPoseStudio } from "@/components/camera-animation-capture";
import { useEntitiesStore } from "@/store/next/entities";
import { useModelsStore } from "@/store/next/models";
import { PersonStandingIcon } from "lucide-react";
import { useMemo } from "react";

export function PoseMenu() {
  const selected = useEntitiesStore((state) => state.selected);
  const models = useModelsStore((state) => state.models);
  const selectedModel = selected ? models[selected] : undefined;
  const loadedModelUuids = useMemo(
    () =>
      Object.entries(models)
        .filter(([, model]) => model.loadState === "loaded")
        .map(([uuid]) => uuid),
    [models],
  );
  const canOpenSelected = selectedModel?.loadState === "loaded";
  const fallbackModelUuid = loadedModelUuids[0];

  return (
    <MenubarMenu>
      <MenubarTrigger>
        <PersonStandingIcon className="h-4 w-4" />
      </MenubarTrigger>
      <MenubarContent className="z-999">
        <MenubarGroup>
          <MenubarItem disabled className="text-xs text-muted-foreground">
            Pose Studio
          </MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem
            disabled={!canOpenSelected}
            onSelect={() => {
              if (selected && canOpenSelected) openPoseStudio(selected);
            }}
          >
            Open Pose Studio
          </MenubarItem>
          <MenubarItem
            disabled={canOpenSelected || !fallbackModelUuid}
            onSelect={() => {
              if (fallbackModelUuid) openPoseStudio(fallbackModelUuid);
            }}
          >
            Open first loaded model
          </MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
}
