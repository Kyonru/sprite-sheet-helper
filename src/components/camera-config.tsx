import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

import { SliderInput } from "./slider-input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { useEffectsStore } from "@/store/effects";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const CameraControls = () => {
  const setPixelation = useEffectsStore((state) => state.setPixelation);
  const pixelation = useEffectsStore((state) => state.pixelation);
  return (
    <Collapsible
      open={pixelation.enabled}
      className="flex flex-col justify-start space-x-2"
    >
      <div className="flex items-center space-x-2">
        <Checkbox
          id="pixelation"
          value={pixelation.enabled ? "on" : "off"}
          onCheckedChange={(checked) => {
            setPixelation({
              ...pixelation,
              enabled: checked === true,
            });
          }}
        />
        <label
          htmlFor="pixelation"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Pixelation
        </label>
      </div>
      <CollapsibleContent className="flex flex-col text-left justify-start space-x-2 p-2">
        <SliderInput
          max={100}
          min={1}
          step={1}
          onChange={(value) =>
            setPixelation({ ...pixelation, granularity: value })
          }
          value={pixelation.granularity}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};

export const CameraConfig = () => {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>
          <Label>Camera</Label>
        </AccordionTrigger>
        <AccordionContent>
          <CameraControls />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
