import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarCheckboxItem,
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EFFECTS, LIGHTS } from "@/constants/effects";
import type { LightType } from "@/types/lighting";
import {
  CameraIcon,
  ConeIcon,
  HelpCircleIcon,
  MenuIcon,
  Move3DIcon,
  RedoIcon,
  Rotate3DIcon,
  Scale3DIcon,
  SparklesIcon,
  SpotlightIcon,
  SunIcon,
  SunsetIcon,
  UndoIcon,
} from "lucide-react";
import type { PropsWithChildren } from "react";

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

const MenuOption = ({
  title,
  children,
}: PropsWithChildren<{
  title: string;
}>) => {
  return (
    <Tooltip key="bottom">
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{title}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const TopPanel = () => {
  return (
    <Menubar className="w-full rounded-none justify-between">
      <div className="flex items-center flex-row">
        <SidebarTrigger className="w-4 h-4 px-4" />
        <MenubarMenu>
          <MenubarTrigger>
            <MenuIcon className="w-4 h-4" />
          </MenubarTrigger>
          <MenubarContent>
            <MenubarGroup>
              <MenubarItem>
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
                    <MenubarItem>Export as ZIP</MenubarItem>
                    <MenubarItem>Export as GIF</MenubarItem>
                    <MenubarItem>Export as SPRITESHEET</MenubarItem>
                  </MenubarGroup>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarGroup>
            <MenubarSeparator />
            <MenubarGroup>
              <MenubarItem>
                Settings... <MenubarShortcut>⌘P</MenubarShortcut>
              </MenubarItem>
            </MenubarGroup>
          </MenubarContent>
        </MenubarMenu>
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
                    {LIGHTS.map((effect) => (
                      <MenubarItem key={effect.key}>
                        <LightIcon type={effect.key} />
                        {effect.name}
                      </MenubarItem>
                    ))}
                  </MenubarGroup>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarGroup>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>
            <SparklesIcon className="w-4 h-4" />
          </MenubarTrigger>
          <MenubarContent>
            <MenubarGroup>
              <MenubarItem>Open Effects View</MenubarItem>
            </MenubarGroup>
            <MenubarSeparator />
            <MenubarGroup>
              <MenubarSub>
                <MenubarSubTrigger>Add new effect</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarGroup className="overflow-y-scroll max-h-[60vh]">
                    {EFFECTS.map((effect) => (
                      <MenubarItem key={effect.key}>{effect.name}</MenubarItem>
                    ))}
                  </MenubarGroup>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarGroup>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>
            <HelpCircleIcon className="w-4 h-4" />
          </MenubarTrigger>
          <MenubarContent>
            <MenubarGroup>
              <MenubarItem>Open Documentation</MenubarItem>
              <MenubarItem>Reset tutorial</MenubarItem>
            </MenubarGroup>
            <MenubarSeparator />
            <MenubarGroup>
              <MenubarItem>Install Desktop App</MenubarItem>
              <MenubarItem>Check for Updates</MenubarItem>
              <MenubarItem>Changelog</MenubarItem>
              <MenubarItem>About</MenubarItem>
            </MenubarGroup>
          </MenubarContent>
        </MenubarMenu>
      </div>
      <div className="flex items-center flex-row">
        <ToggleGroup
          type="single"
          size="sm"
          defaultValue="transform"
          variant="default"
        >
          <ToggleGroupItem value="transform" aria-label="Toggle transform">
            <MenuOption title="Transform">
              <Move3DIcon className="w-4 h-4 text-emerald-700" />
            </MenuOption>
          </ToggleGroupItem>
          <ToggleGroupItem value="scale" aria-label="Toggle scale">
            <MenuOption title="Scale">
              <Scale3DIcon className="w-4 h-4 text-rose-700" />
            </MenuOption>
          </ToggleGroupItem>
          <ToggleGroupItem value="rotate" aria-label="Toggle rotate">
            <MenuOption title="Rotate">
              <Rotate3DIcon className="w-4 h-4 text-cyan-700" />
            </MenuOption>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex items-center flex-row gap-2 pr-4">
        <MenuOption title="Undo">
          <Button variant="ghost" size="icon" className="size-6 rounded-xs">
            <UndoIcon className="size-4" />
          </Button>
        </MenuOption>

        <MenuOption title="Redo">
          <Button variant="ghost" size="icon" className="size-6 rounded-xs">
            <RedoIcon className="size-4" />
          </Button>
        </MenuOption>
      </div>
    </Menubar>
  );
};

export default TopPanel;
