import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { LIGHTS } from "@/constants/effects";
import { useAddLight } from "@/hooks/next/use-add-light";
import type { LightType } from "@/types/lighting";
import { ConeIcon, SpotlightIcon, SunIcon, SunsetIcon } from "lucide-react";
import { useMainPanelStore } from "../main/store";

const LightIcon = ({ type }: { type: LightType }) => {
  switch (type) {
    case "ambient":
      return <SunIcon className="w-4 h-4" />;
    case "directional":
      return <SunsetIcon className="w-4 h-4" />;
    case "point":
      return <ConeIcon className="w-4 h-4" />;
    case "spot":
      return <SpotlightIcon className="w-4 h-4" />;
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
        <MenubarGroup>
          <MenubarSub>
            <MenubarSubTrigger>Add light</MenubarSubTrigger>
            <MenubarSubContent>
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
            </MenubarSubContent>
          </MenubarSub>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
