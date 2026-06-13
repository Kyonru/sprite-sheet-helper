import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangleIcon,
  BarChart3Icon,
  BoxIcon,
  ChevronDownIcon,
  DownloadIcon,
  EyeIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  WandSparklesIcon,
  ListChecksIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_MODEL_DOWNGRADE_RECIPE,
  MODEL_DOWNGRADE_PRESET_LIST,
  MODEL_DOWNGRADE_PRESETS,
} from "@/constants/model-downgrade";
import { useEntitiesStore, useEntity } from "@/store/next/entities";
import { useModelDowngradesStore } from "@/store/next/model-downgrades";
import type {
  ModelDowngradePresetId,
  ModelDowngradeRecipe,
} from "@/types/model-downgrade";
import { downloadFile } from "@/utils/assets";
import { exportDowngradedGlb } from "@/utils/model-downgrade";
import { getDowngradedRuntimeModel } from "@/utils/model-downgrade-runtime";
import { toast } from "sonner";

export const DowngradeContext = () => {
  const selected = useEntitiesStore((state) => state.selected);

  return <ModelDowngradePanel modelUuid={selected} />;
};

export function ModelDowngradePanel({
  modelUuid,
  embedded = false,
}: {
  modelUuid?: string;
  embedded?: boolean;
}) {
  const entity = useEntity(modelUuid);
  const entry = useModelDowngradesStore((state) =>
    modelUuid ? state.entries[modelUuid] : undefined,
  );
  const setRecipe = useModelDowngradesStore((state) => state.setRecipe);
  const analyze = useModelDowngradesStore((state) => state.analyze);
  const preview = useModelDowngradesStore((state) => state.preview);
  const apply = useModelDowngradesStore((state) => state.apply);
  const reset = useModelDowngradesStore((state) => state.reset);
  const [exporting, setExporting] = useState(false);

  const recipe = entry?.recipe ?? DEFAULT_MODEL_DOWNGRADE_RECIPE;
  const analysis = entry?.report?.before ?? entry?.analysis;
  const after = entry?.report?.after;
  const busy = entry?.status === "analyzing" || entry?.status === "previewing";
  const warnings = entry?.report?.warnings ?? [];
  const operations = entry?.report?.operations ?? [];

  const updateRecipe = (props: Partial<ModelDowngradeRecipe>) => {
    if (!modelUuid) return;
    setRecipe(modelUuid, props);
  };

  const runAnalyze = async () => {
    if (!modelUuid) return;
    await analyze(modelUuid);
  };

  const runPreview = async () => {
    if (!modelUuid) return;
    await preview(modelUuid);
    const nextEntry = useModelDowngradesStore.getState().entries[modelUuid];
    if (nextEntry?.status === "ready") {
      toast.success("Downgraded preview is active");
    }
  };

  const runApply = async () => {
    if (!modelUuid) return;
    const applied = await apply(modelUuid);
    const nextEntry = useModelDowngradesStore.getState().entries[modelUuid];
    if (!applied || nextEntry?.status === "error") {
      toast.error("Downgrade apply failed", {
        description:
          nextEntry?.errorMessage ?? "Preview generation was not completed.",
      });
      return;
    }
    toast.success("Downgraded variant applied");
  };

  const runReset = () => {
    if (!modelUuid) return;
    reset(modelUuid);
    toast.success("Original model restored");
  };

  const runExport = async () => {
    if (!modelUuid || exporting) return;
    setExporting(true);
    try {
      if (!getDowngradedRuntimeModel(modelUuid)) {
        await preview(modelUuid);
      }
      const runtime = getDowngradedRuntimeModel(modelUuid);
      if (!runtime) throw new Error("Downgraded model is not ready.");
      const buffer = await exportDowngradedGlb(
        runtime.object,
        runtime.clips.map(({ clip }) => clip),
      );
      const name = `${(entity?.name ?? "model").replace(/\s+/g, "_")}_downgraded.glb`;
      downloadFile(new Blob([buffer], { type: "model/gltf-binary" }), name);
    } catch (error) {
      toast.error("GLB export failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setExporting(false);
    }
  };

  const reduction = useMemo(() => {
    if (!analysis || !after || analysis.triangleCount === 0) return undefined;
    return Math.round(
      (1 - after.triangleCount / analysis.triangleCount) * 100,
    );
  }, [after, analysis]);

  if (!modelUuid || entity?.type !== "model") return null;

  return (
    <div
      className={
        embedded ? "grid min-h-0 gap-3" : "grid min-h-0 gap-3 p-1 pb-8"
      }
    >
      <CollapsibleSection
        icon={<SlidersHorizontalIcon className="size-4" />}
        title="Downgrade"
        triggerTestId="downgrade-section-trigger"
        subtitle={
          entry?.activeVariant === "downgraded"
            ? "Downgraded variant active"
            : "Original model active"
        }
      >
        <div className="grid gap-3 p-3">
          <label className="grid gap-1.5 text-xs font-medium">
            Preset
            <Select
              value={recipe.presetId}
              onValueChange={(value) =>
                updateRecipe(
                  MODEL_DOWNGRADE_PRESETS[value as ModelDowngradePresetId]
                    .recipe,
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_DOWNGRADE_PRESET_LIST.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
            <NumberField
              label="Triangle budget"
              value={recipe.triangleBudget}
              min={1}
              step={50}
              inputTestId="downgrade-triangle-budget-input"
              onChange={(triangleBudget) => updateRecipe({ triangleBudget })}
            />
            <NumberField
              label="Texture size"
              value={recipe.textureSize}
              min={16}
              step={16}
              inputTestId="downgrade-texture-size-input"
              onChange={(textureSize) => updateRecipe({ textureSize })}
            />
            <NumberField
              label="Palette colors"
              value={recipe.paletteColors}
              min={2}
              step={1}
              inputTestId="downgrade-palette-colors-input"
              onChange={(paletteColors) => updateRecipe({ paletteColors })}
            />
            <NumberField
              label="Snap vertices"
              value={recipe.snapVertices}
              min={0}
              step={0.0025}
              inputTestId="downgrade-snap-vertices-input"
              onChange={(snapVertices) => updateRecipe({ snapVertices })}
            />
            <NumberField
              label="Animation FPS"
              value={recipe.animationFps}
              min={1}
              step={1}
              inputTestId="downgrade-animation-fps-input"
              onChange={(animationFps) => updateRecipe({ animationFps })}
            />
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            <ToggleRow
              label="Flat shading"
              checked={recipe.flatShading}
              onCheckedChange={(flatShading) => updateRecipe({ flatShading })}
            />
            <ToggleRow
              label="Nearest filtering"
              checked={recipe.nearestFiltering}
              onCheckedChange={(nearestFiltering) =>
                updateRecipe({ nearestFiltering })
              }
            />
            <ToggleRow
              label="Simplify materials"
              checked={recipe.simplifyMaterials}
              onCheckedChange={(simplifyMaterials) =>
                updateRecipe({ simplifyMaterials })
              }
            />
            <ToggleRow
              label="Merge vertices"
              checked={recipe.mergeVertices}
              onCheckedChange={(mergeVertices) =>
                updateRecipe({ mergeVertices })
              }
            />
            <ToggleRow
              label="Remove tiny islands"
              checked={recipe.removeTinyIslands}
              onCheckedChange={(removeTinyIslands) =>
                updateRecipe({ removeTinyIslands })
              }
            />
            <ToggleRow
              label="Stepped animation"
              checked={recipe.steppedAnimation}
              onCheckedChange={(steppedAnimation) =>
                updateRecipe({ steppedAnimation })
              }
            />
            <ToggleRow
              label="Dither textures"
              checked={recipe.ditherTextures}
              onCheckedChange={(ditherTextures) =>
                updateRecipe({ ditherTextures })
              }
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<BarChart3Icon className="size-4" />}
        title="Analysis"
        triggerTestId="downgrade-analysis-section-trigger"
        subtitle={
          reduction === undefined
            ? "Analyze or preview to see model metrics"
            : `${reduction}% triangle reduction`
        }
      >
        <div className="grid grid-cols-2 gap-2 p-3">
          <Metric label="Triangles" before={analysis?.triangleCount} after={after?.triangleCount} />
          <Metric label="Meshes" before={analysis?.meshCount} after={after?.meshCount} />
          <Metric label="Materials" before={analysis?.materialCount} after={after?.materialCount} />
          <Metric label="Textures" before={analysis?.textureCount} after={after?.textureCount} />
          <Metric label="Max texture" before={analysis?.maxTextureSize} after={after?.maxTextureSize} suffix="px" />
          <Metric label="Bones" before={analysis?.boneCount} after={after?.boneCount} />
          <Metric label="Animations" before={analysis?.animationCount} after={after?.animationCount} />
          <Metric label="Keyframes" before={analysis?.animationKeyframeCount} after={after?.animationKeyframeCount} />
          <Metric label="Static meshes" before={analysis?.staticMeshCount} after={after?.staticMeshCount} />
          <Metric label="Skinned meshes" before={analysis?.skinnedMeshCount} after={after?.skinnedMeshCount} />
        </div>
        {warnings.length > 0 ? (
          <div className="grid gap-1 border-t p-3">
            {warnings.map((warning) => (
              <div
                key={warning}
                className="flex min-w-0 items-start gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground"
              >
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0">{warning}</span>
              </div>
            ))}
          </div>
        ) : null}
        {operations.length > 0 ? (
          <div className="grid gap-1 border-t p-3">
            <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
              <ListChecksIcon className="size-3.5 shrink-0" />
              <span>Operations</span>
            </div>
            <div className="grid gap-1">
              {operations.map((operation) => (
                <div
                  key={operation}
                  className="rounded-md border bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground"
                >
                  {operation}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {entry?.errorMessage ? (
          <div className="border-t p-3 text-xs text-destructive">
            {entry.errorMessage}
          </div>
        ) : null}
      </CollapsibleSection>

      <section className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          data-testid="downgrade-analyze-button"
          disabled={busy}
          onClick={runAnalyze}
        >
          <BarChart3Icon className="size-3.5" />
          Analyze
        </Button>
        <Button
          size="sm"
          variant="outline"
          data-testid="downgrade-preview-button"
          disabled={busy}
          onClick={runPreview}
        >
          <EyeIcon className="size-3.5" />
          Preview Clone
        </Button>
        <Button
          size="sm"
          data-testid="downgrade-apply-button"
          disabled={busy}
          onClick={runApply}
        >
          <WandSparklesIcon className="size-3.5" />
          Apply
        </Button>
        <Button size="sm" variant="outline" onClick={runReset}>
          <RotateCcwIcon className="size-3.5" />
          Reset
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="col-span-2"
          disabled={busy || exporting}
          onClick={runExport}
        >
          <DownloadIcon className="size-3.5" />
          Export GLB
        </Button>
      </section>
    </div>
  );
}

function CollapsibleSection({
  icon,
  title,
  triggerTestId,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  triggerTestId?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen={false} className="rounded-md border bg-background">
      <CollapsibleTrigger
        type="button"
        data-testid={triggerTestId}
        className="group flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/35"
      >
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          {subtitle ? (
            <div className="truncate text-[11px] text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NumberField({
  label,
  value,
  min,
  step,
  inputTestId,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  inputTestId?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium">
      <span className="truncate">{label}</span>
      <Input
        type="number"
        data-testid={inputTestId}
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-2 py-2 text-xs">
      <span className="min-w-0 truncate">{label}</span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
      />
    </label>
  );
}

function Metric({
  label,
  before,
  after,
  suffix = "",
}: {
  label: string;
  before?: number;
  after?: number;
  suffix?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/10 p-2">
      <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
        <BoxIcon className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-sm font-medium tabular-nums">
        {formatMetric(before, suffix)}
        {after !== undefined ? (
          <span className="text-muted-foreground">
            {" -> "}
            {formatMetric(after, suffix)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatMetric(value?: number, suffix = "") {
  if (value === undefined) return "-";
  return `${value.toLocaleString()}${suffix}`;
}
