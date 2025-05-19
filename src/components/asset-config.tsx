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
import { EffectsConfig } from "./effects-config";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

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
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>
          <Label>Model file</Label>
        </AccordionTrigger>
        <AccordionContent>
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export const AssetConfig = () => {
  return (
    <>
      <SidebarMenuItem key={"model"}>
        <ModelConfig />
      </SidebarMenuItem>
      <SidebarMenuItem key={"effects"}>
        <EffectsConfig />
      </SidebarMenuItem>
    </>
  );
};
