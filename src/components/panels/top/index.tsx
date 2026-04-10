import { Menubar } from "@/components/ui/menubar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTransformsStore } from "@/store/next/transforms";
import type { Transform } from "@/types/transform";
import { Move3DIcon, Rotate3DIcon, Scale3DIcon } from "lucide-react";
import { MenuOption } from "./menu-option";
import { LightMenu } from "./lighting";
import { HistoryActions } from "./history";
import { EffectsMenu } from "./effects";
import { FileMenu } from "./file";
import { CameraMenu } from "./camera";
import { HelpMenu } from "./help";

const TransformOptions = [
  {
    value: "translate",
    title: "Translate",
    icon: <Move3DIcon className="w-4 h-4 text-emerald-700" />,
  },
  {
    value: "scale",
    title: "Scale",
    icon: <Scale3DIcon className="w-4 h-4 text-rose-700" />,
  },
  {
    value: "rotate",
    title: "Rotate",
    icon: <Rotate3DIcon className="w-4 h-4 text-cyan-700" />,
  },
];

const TransformMenu = () => {
  const transformMode = useTransformsStore((state) => state.mode);
  const setTransformMode = useTransformsStore((state) => state.setMode);
  return (
    <div className="flex items-center flex-row">
      <ToggleGroup
        type="single"
        size="sm"
        defaultValue="translate"
        variant="default"
        value={transformMode}
        onValueChange={(value?: string) => {
          if (value) {
            setTransformMode(value as Transform);
          }
        }}
      >
        {TransformOptions.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={`Toggle ${option.title}`}
          >
            <MenuOption title={option.title}>{option.icon}</MenuOption>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};

const TopPanel = () => {
  return (
    <Menubar className="w-full rounded-none justify-between">
      <div className="flex items-center flex-row">
        <FileMenu />
        <CameraMenu />
        <LightMenu />
        <EffectsMenu />
        <HelpMenu />
      </div>
      <TransformMenu />
      <HistoryActions />
    </Menubar>
  );
};

export default TopPanel;
