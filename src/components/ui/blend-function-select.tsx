import { BlendFunction } from "postprocessing";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

interface BlendFunctionSelectProps {
  value: number;
  onChange: (value: string) => void;
}

export const BlendFunctionSelect = ({
  value,
  onChange,
}: BlendFunctionSelectProps) => {
  return (
    <Select value={`${value}`} onValueChange={onChange}>
      <SelectTrigger className="mt-1">
        <SelectValue placeholder="Blend Function" />
      </SelectTrigger>
      <SelectContent>
        {Object.keys(BlendFunction).map((key) => (
          <SelectItem
            key={`item-${(BlendFunction as unknown as Record<string, number>)[key]}-${key}`}
            value={`${(BlendFunction as unknown as Record<string, number>)[key]}`}
          >
            {key}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
