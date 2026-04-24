import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModelsStore } from "@/store/next/models";
import { parseModel } from "@/utils/model";
import {
  BODY_PART_LABELS,
  MIXAMO_DEFAULT_REMAP,
  autoDetectRemap,
  type BoneRemap,
} from "@/utils/bone-remap";
import type { ModelComponent } from "@/types/ecs";
import { RotateCcw, Wand2 } from "lucide-react";

interface Props {
  modelUuid: string;
  remap: BoneRemap;
  onChange: (remap: BoneRemap) => void;
}

export function BoneRemapPanel({ modelUuid, remap, onChange }: Props) {
  const model = useModelsStore((s) => s.models[modelUuid]);
  const [availableBones, setAvailableBones] = useState<string[]>([]);

  // Discover all bone names from the model once
  useEffect(() => {
    if (!model?.file) return;
    const format = model.file.name.split(".").pop()?.toLowerCase() as ModelComponent["format"];
    if (!format) return;

    parseModel(model.file, format).then((parsed) => {
      const names: string[] = [];
      parsed.object.traverse((child) => {
        if (child.name) names.push(child.name);
      });
      setAvailableBones(names.sort());
    });
  }, [model?.file]);

  const keys = useMemo(() => Object.keys(BODY_PART_LABELS) as (keyof BoneRemap)[], []);

  const handleChange = (key: keyof BoneRemap, value: string) => {
    onChange({ ...remap, [key]: value });
  };

  const handleAutoDetect = () => {
    onChange(autoDetectRemap(availableBones));
  };

  const handleReset = () => {
    onChange({ ...MIXAMO_DEFAULT_REMAP });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Bone Mapping
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleAutoDetect} title="Auto-detect from bone names">
            <Wand2 size={12} className="mr-1" /> Auto-detect
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} title="Reset to Mixamo defaults">
            <RotateCcw size={12} className="mr-1" /> Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-64 overflow-y-auto pr-1">
        {keys.map((key) => (
          <div key={key} className="flex flex-col gap-0.5">
            <Label className="text-xs text-muted-foreground truncate" title={BODY_PART_LABELS[key]}>
              {BODY_PART_LABELS[key]}
            </Label>
            <Input
              className="h-7 text-xs font-mono"
              value={remap[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              list={`bones-${key}`}
            />
            <datalist id={`bones-${key}`}>
              {availableBones.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
        ))}
      </div>

      {availableBones.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {availableBones.length} bones found in model. Type to filter or pick from suggestions.
        </p>
      )}
    </div>
  );
}
