import { Slider } from "@/components/ui/slider";
import { Input } from "./ui/input";

interface SliderInputProps {
  max: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
  value: number;
}

export const SliderInput = ({
  max,
  min,
  step,
  onChange,
  value,
}: SliderInputProps) => {
  return (
    <div className="flex flex-row gap-2 overflow-hidden items-center">
      <div className="flex-1 min-w-0">
        <Slider
          onValueChange={([value]) => onChange(value)}
          value={[value]}
          min={min}
          max={max}
          step={step}
        />
      </div>
      <div className="flex-none">
        <Input
          type="number"
          onChange={(e) => onChange(Number(e.target.value))}
          value={value}
          min={min}
          max={max}
          step={step}
        />
      </div>
    </div>
  );
};
