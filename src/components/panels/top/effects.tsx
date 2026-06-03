import {
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  EFFECT_CATEGORY_LABELS,
  EFFECT_CATEGORY_ORDER,
  EFFECT_METADATA,
} from "@/constants/effects";
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
      <MenubarContent className="z-999">
        <MenubarGroup>
          <MenubarItem disabled>Add new effect</MenubarItem>
        </MenubarGroup>
        <MenubarSeparator />
        <MenubarGroup>
          {EFFECT_CATEGORY_ORDER.map((category) => (
            <MenubarSub key={category}>
              <MenubarSubTrigger>
                {EFFECT_CATEGORY_LABELS[category]}
              </MenubarSubTrigger>
              <MenubarSubContent className="z-999">
                {EFFECT_METADATA.filter(
                  (effect) => effect.category === category,
                ).map((effect) => (
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
              </MenubarSubContent>
            </MenubarSub>
          ))}
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  );
};
