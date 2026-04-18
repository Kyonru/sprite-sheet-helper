import {
  MenubarContent,
  MenubarGroup,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { ACCEPTED_MODEL_FILE_TYPES, PROJECT_FILE_TYPE } from "@/constants/file";
import { useAddModel } from "@/hooks/next/use-add-model";
import {
  GetExportShortcut,
  EventType,
  PubSub,
  ShortCutEventType,
} from "@/lib/events";
import { MenuIcon } from "lucide-react";
import { openSettings } from "./settings";
import { useProjectStore } from "@/store/next/project";
import { MenubarItemAction } from "./components/MenubarItemAction";
import { importFile } from "@/utils/assets";
import { exporters } from "@/utils/exports";

export const FileMenu = () => {
  const loadFromFile = useAddModel(true);
  const projectStore = useProjectStore();

  return (
    <MenubarMenu>
      <MenubarTrigger>
        <MenuIcon className="w-4 h-4" />
      </MenubarTrigger>
      <MenubarContent className="z-999">
        <MenubarGroup>
          <MenubarItemAction
            title="Import Model"
            action={() => importFile(ACCEPTED_MODEL_FILE_TYPES, loadFromFile)}
            shortcut={ShortCutEventType.IMPORT_MODEL}
          />
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItemAction
            title="New project..."
            action={projectStore.new}
            shortcut={ShortCutEventType.NEW_PROJECT}
          />
          <MenubarItemAction
            title="Open project..."
            action={() => importFile([PROJECT_FILE_TYPE], projectStore.load)}
            shortcut={ShortCutEventType.OPEN_PROJECT}
          />
          <MenubarItemAction
            title="Quick save"
            action={projectStore.save}
            shortcut={ShortCutEventType.QUICK_SAVE}
          />
          <MenubarItemAction
            title="Save project..."
            action={projectStore.saveAs}
            shortcut={ShortCutEventType.SAVE_AS}
          />
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarSub>
            <MenubarSubTrigger>Export</MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarGroup>
                {Object.values(exporters).map((exporter) => (
                  <MenubarItemAction
                    title={exporter.label}
                    action={() =>
                      PubSub.emit(EventType.START_EXPORT, exporter.id)
                    }
                    shortcut={GetExportShortcut(exporter.id)}
                  />
                ))}
              </MenubarGroup>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItemAction
            title="Settings..."
            action={openSettings}
            shortcut={ShortCutEventType.OPEN_SETTINGS}
          />
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
