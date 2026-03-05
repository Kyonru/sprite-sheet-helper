import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { CameraIcon } from "lucide-react";

export const CameraMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>
        <CameraIcon className="w-4 h-4" />
      </MenubarTrigger>
      <MenubarContent className="w-44">
        <MenubarGroup>
          <MenubarCheckboxItem checked>Perspective</MenubarCheckboxItem>
          <MenubarCheckboxItem>Orthographic</MenubarCheckboxItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem>Perspective Settings</MenubarItem>
          <MenubarItem>Orbit Settings</MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          <MenubarItem inset>Toggle Fullscreen</MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
