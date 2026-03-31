import { Input } from "@/components/ui/input";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { ACCEPTED_MODEL_FILE_TYPES } from "@/constants/file";
import { useAddModel } from "@/hooks/next/use-add-model";
import { EventType, PubSub } from "@/lib/events";
import { MenuIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { openSettings } from "./settings";

export const FileMenu = () => {
  const loadFromFile = useAddModel(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onImportModel = () => {
    fileInputRef.current?.click();
  };

  const onLoadModel = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    try {
      await loadFromFile(file);
    } catch {
      toast.error("Failed to load model.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <Input
        ref={fileInputRef}
        id="model"
        type="file"
        className="hidden"
        accept={`.${ACCEPTED_MODEL_FILE_TYPES.join(",.")}`}
        onChange={onLoadModel}
      />
      <MenubarMenu>
        <MenubarTrigger>
          <MenuIcon className="w-4 h-4" />
        </MenubarTrigger>
        <MenubarContent className="z-999">
          <MenubarGroup>
            <MenubarItem onClick={onImportModel}>
              Import Model <MenubarShortcut>⌘I</MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem>
              Open project <MenubarShortcut>⌘N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem>
              Quick save <MenubarShortcut>⌘S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem>
              Save project.. <MenubarShortcut>⌘N</MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarSub>
              <MenubarSubTrigger>Export</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarGroup>
                  <MenubarItem
                    onClick={() => PubSub.emit(EventType.START_EXPORT, "zip")}
                  >
                    Export as ZIP
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => PubSub.emit(EventType.START_EXPORT, "gif")}
                  >
                    Export as GIF
                  </MenubarItem>
                  <MenubarItem
                    onClick={() =>
                      PubSub.emit(EventType.START_EXPORT, "spritesheet")
                    }
                  >
                    Export as SPRITESHEET
                  </MenubarItem>
                </MenubarGroup>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarGroup>
          <MenubarSeparator />
          <MenubarGroup>
            <MenubarItem onClick={() => openSettings()}>
              Settings... <MenubarShortcut>⌘P</MenubarShortcut>
            </MenubarItem>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </>
  );
};
