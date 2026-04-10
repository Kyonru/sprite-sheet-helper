import { openAbout } from "@/components/about-modal";
import { openDocs } from "@/components/docs";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { openUrl } from "@/utils/linking";
import { HelpCircleIcon } from "lucide-react";
import { useCallback } from "react";

export const HelpMenu = () => {
  const onOpenDesktopApp = useCallback(() => {
    openUrl("https://github.com/Kyonru/sprite-sheet-helper/releases/latest");
  }, []);

  return (
    <MenubarMenu>
      <MenubarTrigger>
        <HelpCircleIcon className="w-4 h-4" />
      </MenubarTrigger>
      <MenubarContent className="z-999">
        <MenubarGroup>
          <MenubarItem onClick={openDocs}>Open Documentation</MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem onClick={onOpenDesktopApp}>
            Install Desktop App
          </MenubarItem>
          {/* <MenubarItem>Check for Updates</MenubarItem> */}
          <MenubarItem onClick={openAbout}>About</MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
