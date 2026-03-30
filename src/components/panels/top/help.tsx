import { openDocs } from "@/components/docs";
import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { HelpCircleIcon } from "lucide-react";

export const HelpMenu = () => {
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
          <MenubarItem>Install Desktop App</MenubarItem>
          <MenubarItem>Check for Updates</MenubarItem>
          <MenubarItem>About</MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
