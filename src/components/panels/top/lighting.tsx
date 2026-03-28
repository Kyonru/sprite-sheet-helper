import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { LIGHTS } from "@/constants/effects";
import { useAddLight } from "@/hooks/next/use-add-light";
import type { LightType } from "@/types/lighting";
import { SunIcon } from "lucide-react";
import { useMainPanelStore } from "../main/store";
import { ItemTypeIconMap } from "../main/explorer/constants";

const LightIcon = ({ type }: { type: LightType }) => {
  const Icon = ItemTypeIconMap[type];
  switch (type) {
    case "ambient":
      return Icon;
    case "directional":
      return Icon;
    case "point":
      return Icon;
    case "spot":
      return Icon;
    default:
      return <></>;
  }
};

export const LightMenu = () => {
  const addLight = useAddLight();
  const selectTab = useMainPanelStore((state) => state.setTab);
  return (
    <MenubarMenu>
      <MenubarTrigger>
        <SunIcon className="w-4 h-4" />
      </MenubarTrigger>
      <MenubarContent>
        <MenubarGroup className="overflow-y-scroll">
          {LIGHTS.map((light) => (
            <MenubarItem
              onClick={() => {
                addLight(light.key, light.name);
                selectTab("explorer");
              }}
              key={light.key}
            >
              <LightIcon type={light.key} />
              {light.name}
            </MenubarItem>
          ))}
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
