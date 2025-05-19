import { Input } from "./ui/input";

type Coordinates = {
  x: number;
  y: number;
  z: number;
};

interface XYZInputProps {
  onChange: (value: Coordinates) => void;
  value: Coordinates;
  step: number;
}

export const XYZInput = ({ onChange, value, step }: XYZInputProps) => {
  const onChangeXYZ = (axis: "x" | "y" | "z", newValue: number) => {
    onChange({
      x: axis === "x" ? newValue : value.x,
      y: axis === "y" ? newValue : value.y,
      z: axis === "z" ? newValue : value.z,
    });
  };

  return (
    <div className="flex flex-row gap-2 overflow-hidden items-center">
      <div className="flex-1 min-w-0">
        <Input
          type="number"
          onChange={(e) => onChangeXYZ("x", Number(e.target.value))}
          value={value.x}
          step={step}
        />
      </div>
      <div className="flex-1 min-w-0">
        <Input
          type="number"
          onChange={(e) => onChangeXYZ("y", Number(e.target.value))}
          value={value.y}
          step={step}
        />
      </div>
      <div className="flex-1 min-w-0">
        <Input
          type="number"
          onChange={(e) => onChangeXYZ("z", Number(e.target.value))}
          value={value.z}
          step={step}
        />
      </div>
    </div>
  );
};
