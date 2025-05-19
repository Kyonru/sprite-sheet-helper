import { ChevronDown } from "lucide-react";
import { SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BlendFunction } from "postprocessing";

import { SliderInput } from "./slider-input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { useEffectsStore } from "@/store/effects";
import { BlendFunctionSelect } from "./ui/blend-function-select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const PixelationEffect = () => {
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

const BloomEffect = () => {
  const setBloom = useEffectsStore((state) => state.setBloom);
  const bloom = useEffectsStore((state) => state.bloom);
  return (
    <Collapsible
      open={bloom.enabled}
      className="flex flex-col justify-start space-x-2"
    >
      <div className="flex items-center space-x-2">
        <Checkbox
          id="bloom"
          value={bloom.enabled ? "on" : "off"}
          onCheckedChange={(checked) => {
            setBloom({
              ...bloom,
              enabled: checked === true,
            });
          }}
        />
        <label
          htmlFor="bloom"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Bloom
        </label>
      </div>
      <CollapsibleContent className="flex flex-col text-left justify-start space-x-2 p-2">
        <Label>Threshold</Label>
        <SliderInput
          max={1}
          min={0}
          step={0.1}
          onChange={(value) =>
            setBloom({ ...bloom, luminanceThreshold: value })
          }
          value={bloom.luminanceThreshold}
        />
        <Label>Smoothing</Label>
        <SliderInput
          max={1}
          min={0}
          step={0.01}
          onChange={(value) =>
            setBloom({ ...bloom, luminanceSmoothing: value })
          }
          value={bloom.luminanceSmoothing}
        />
        <Label>Intensity</Label>
        <SliderInput
          max={5}
          min={0}
          step={0.1}
          onChange={(value) => setBloom({ ...bloom, intensity: value })}
          value={bloom.intensity}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};

const NoiseEffect = () => {
  const setNoise = useEffectsStore((state) => state.setNoise);
  const noise = useEffectsStore((state) => state.noise);
  return (
    <Collapsible
      open={noise.enabled}
      className="flex flex-col justify-start space-x-2"
    >
      <div className="flex items-center space-x-2">
        <Checkbox
          id="noise"
          value={noise.enabled ? "on" : "off"}
          onCheckedChange={(checked) => {
            setNoise({
              ...noise,
              enabled: checked === true,
            });
          }}
        />
        <label
          htmlFor="noise"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Noise
        </label>
      </div>
      <CollapsibleContent className="flex flex-col text-left justify-start space-x-2 p-2">
        <div className="flex items-center space-x-2 pb-2 pt-1">
          <Checkbox
            id="noise"
            value={noise.enabled ? "on" : "off"}
            onCheckedChange={(checked) => {
              setNoise({
                ...noise,
                premultiply: checked === true,
              });
            }}
          />
          <label
            htmlFor="noise"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Premultiply
          </label>
        </div>
        <div className="flex items-center space-x-2 pb-2 pt-1">
          <Label>Blend Function</Label>
          <BlendFunctionSelect
            value={noise.blendFunction}
            onChange={(n) => {
              setNoise({
                ...noise,
                blendFunction: +n as unknown as BlendFunction,
              });
            }}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const DepthOfFieldEffect = () => {
  const setDepthOfField = useEffectsStore((state) => state.setDepthOfField);
  const depthOfField = useEffectsStore((state) => state.depthOfField);
  return (
    <Collapsible
      open={depthOfField.enabled}
      className="flex flex-col justify-start space-x-2"
    >
      <div className="flex items-center space-x-2">
        <Checkbox
          id="depthOfField"
          value={depthOfField.enabled ? "on" : "off"}
          onCheckedChange={(checked) => {
            setDepthOfField({
              ...depthOfField,
              enabled: checked === true,
            });
          }}
        />
        <label
          htmlFor="depthOfField"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Death of Field
        </label>
      </div>
      <CollapsibleContent className="flex flex-col text-left justify-start space-x-2 p-2">
        <Label>Focus Distance</Label>
        <SliderInput
          max={1}
          min={0}
          step={0.05}
          onChange={(value) =>
            setDepthOfField({ ...depthOfField, focusDistance: value })
          }
          value={depthOfField.focusDistance}
        />
        <Label>Focal Length</Label>
        <SliderInput
          max={1}
          min={0}
          step={0.05}
          onChange={(value) =>
            setDepthOfField({ ...depthOfField, focalLength: value })
          }
          value={depthOfField.focalLength}
        />
        <Label>Bokeh Scale</Label>
        <SliderInput
          max={20}
          min={0}
          step={0.1}
          onChange={(value) =>
            setDepthOfField({ ...depthOfField, bokehScale: value })
          }
          value={depthOfField.bokehScale}
        />
        <div className="flex items-center space-x-2 pb-2 pt-1">
          <Label>Blend Function</Label>
          <BlendFunctionSelect
            value={depthOfField.blendFunction}
            onChange={(n) => {
              setDepthOfField({
                ...depthOfField,
                blendFunction: +n as unknown as BlendFunction,
              });
            }}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const EffectsConfig = () => {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>
          <Label>Effects</Label>
        </AccordionTrigger>
        <AccordionContent>
          <PixelationEffect />
          <BloomEffect />
          <NoiseEffect />
          <DepthOfFieldEffect />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
