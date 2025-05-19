import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ACCEPTED_MODEL_FILE_TYPES } from "@/constants/file";
import { useModelStore } from "@/store/model";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { SliderInput } from "./slider-input";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { XYZInput } from "./xyzInput";

const ModelConfig = () => {
  const setModelFile = useModelStore((state) => state.setFile);
  const setPosition = useModelStore((state) => state.setPosition);
  const setScale = useModelStore((state) => state.setScale);
  const setRotation = useModelStore((state) => state.setRotation);
  const scale = useModelStore((state) => state.scale);
  const position = useModelStore((state) => state.position);
  const rotation = useModelStore((state) => state.rotation);

  const onPositionChange = (position: { x: number; y: number; z: number }) => {
    setPosition([position.x, position.y, position.z]);
  };

  const onRotationChange = (rotation: { x: number; y: number; z: number }) => {
    setRotation([rotation.x, rotation.y, rotation.z]);
  };

  const positionObj = useMemo(() => {
    return {
      x: position[0] || 0,
      y: position[1] || 0,
      z: position[2] || 0,
    };
  }, [position]);

  const rotationObj = useMemo(() => {
    return {
      x: rotation[0] || 0,
      y: rotation[1] || 0,
      z: rotation[2] || 0,
    };
  }, [rotation]);

  return (
    <Collapsible defaultOpen={false} className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between space-x-4 px-4">
              <Label htmlFor="model">Model file</Label>
              <Button variant="ghost" size="sm">
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                <span className="sr-only">Toggle</span>
              </Button>
            </div>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <div className="grid w-full max-w-sm items-center gap-1.5 justify-center">
          <Input
            id="model"
            type="file"
            accept={`.${ACCEPTED_MODEL_FILE_TYPES.join(",.")}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setModelFile(file);
            }}
          />
        </div>
        <CollapsibleContent className="space-y-2">
          <div className="grid w-full max-w-sm gap-1.5 pt-2">
            <Label>Position</Label>
            <XYZInput
              onChange={onPositionChange}
              value={positionObj}
              step={0.1}
            />
          </div>
          <div className="grid w-full max-w-sm gap-1.5 pt-2">
            <Label>Rotation</Label>
            <XYZInput
              onChange={onRotationChange}
              value={rotationObj}
              step={0.01}
            />
          </div>
          <div className="grid w-full max-w-sm gap-1.5 pt-2">
            <Label>Scale</Label>
            <SliderInput
              max={2}
              min={0.01}
              step={0.01}
              onChange={(value) => setScale(value)}
              value={scale}
            />
          </div>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
};

export const AssetConfig = () => {
  return (
    <>
      <SidebarMenuItem className="pt-4" key={"model"}>
        <ModelConfig />
      </SidebarMenuItem>
    </>
  );
};
