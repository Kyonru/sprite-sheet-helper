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
import { analyzeBoneMapping } from "@/utils/pose-retargeting";
import type { ModelComponent } from "@/types/ecs";
import { AlertTriangle, RotateCcw, Wand2 } from "lucide-react";

interface Props {
  modelUuid: string;
  remap: BoneRemap;
  onChange: (remap: BoneRemap) => void;
  availableBones?: string[];
}

export function BoneRemapPanel({
  modelUuid,
  remap,
  onChange,
  availableBones: externalAvailableBones,
}: Props) {
  const model = useModelsStore((s) => s.models[modelUuid]);
  const [discoveredBones, setDiscoveredBones] = useState<string[]>([]);
  const availableBones = externalAvailableBones ?? discoveredBones;

  // Discover all bone names from the model once
  useEffect(() => {
    if (externalAvailableBones) return;
    if (!model?.file) return;
    const format = model.file.name.split(".").pop()?.toLowerCase() as ModelComponent["format"];
    if (!format) return;

    parseModel(model.file, format).then((parsed) => {
      const names: string[] = [];
      parsed.object.traverse((child) => {
        if (child.name) names.push(child.name);
      });
      setDiscoveredBones([...new Set(names)].sort());
    });
  }, [externalAvailableBones, model?.file]);

  const keys = useMemo(() => Object.keys(BODY_PART_LABELS) as (keyof BoneRemap)[], []);
  const mappingAnalysis = useMemo(
    () => analyzeBoneMapping(remap, availableBones),
    [availableBones, remap],
  );

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

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        {mappingAnalysis.groups.map((group) => (
          <span
            key={group.name}
            className={`rounded-md border px-2 py-1 ${
              group.mapped === group.total
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                : "border-amber-500/25 bg-amber-500/10 text-amber-700"
            }`}
            title={
              group.missing.length
                ? `Missing ${group.missing
                    .map((key) => BODY_PART_LABELS[key])
                    .join(", ")}`
                : "Complete"
            }
          >
            {group.name}: {group.mapped}/{group.total}
          </span>
        ))}
      </div>

      {mappingAnalysis.issues.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            {mappingAnalysis.issues.slice(0, 3).join(" · ")}
            {mappingAnalysis.issues.length > 3 && " · …"}
          </span>
        </div>
      )}

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
