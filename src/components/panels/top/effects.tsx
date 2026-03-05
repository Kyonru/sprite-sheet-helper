import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { EFFECTS } from "@/constants/effects";
import { useEffectsStore } from "@/store/next/effects";
import { SparklesIcon } from "lucide-react";
import { useMainPanelStore } from "../main/store";

export const EffectsMenu = () => {
  const initEffect = useEffectsStore((state) => state.initEffect);
  const selectTab = useMainPanelStore((state) => state.setTab);
  return (
    <MenubarMenu>
      <MenubarTrigger>
        <SparklesIcon className="w-4 h-4" />
      </MenubarTrigger>
      <MenubarContent className="z-[999]">
        <MenubarGroup>
          <MenubarItem disabled>Add new effect</MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup className="overflow-y-scroll max-h-[60vh]">
          {EFFECTS.map((effect) => (
            <MenubarItem
              onSelect={() => {
                initEffect(effect.key);
                selectTab("effects");
              }}
              key={effect.key}
            >
              {effect.name}
            </MenubarItem>
          ))}
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
