import { useMemo } from "react";
import {
  AlertTriangle,
  Info,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { confirm } from "@/components/confirm";
import { openShaderEditor } from "@/components/custom-shader-modal";
import { InspectorPanel, type InspectorField } from "@/components/inspector";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BLEND_FUNCTIONS,
  EDGE_DETECTION_MODES,
  EFFECT_CATEGORY_LABELS,
  EFFECT_CATEGORY_ORDER,
  EFFECT_METADATA,
  EFFECT_METADATA_BY_TYPE,
  EFFECT_PRESETS,
  GLITCH_MODES,
  PREDICATION_MODES,
  SMAA_PRESETS,
  TONE_MAPPING_MODES,
  type EffectPresetId,
} from "@/constants/effects";
import { cn } from "@/lib/utils";
import { useEffectsStore } from "@/store/next/effects";
import type { EffectType } from "@/types/effects";
import { getEffectGuidance, getOrderedEffects } from "@/utils/effects";
import { PALETTE_INDEX } from "../../scene/custom-effects.tsx/palette";

const MODE_OPTIONS_MAP: Partial<
  Record<EffectType, Record<string, number | string>>
> = {
  tonemap: TONE_MAPPING_MODES,
  glitch: GLITCH_MODES,
};

const OPTIONS_MAP: Record<string, Record<string, number | string>> = {
  blendFunction: BLEND_FUNCTIONS,
  preset: SMAA_PRESETS,
  edgeDetectionMode: EDGE_DETECTION_MODES,
  predicationMode: PREDICATION_MODES,
  palette: PALETTE_INDEX,
};

const CONTROL_LABELS: Record<string, string> = {
  adaptive: "Adaptive",
  alphaThreshold: "Alpha Threshold",
  amplitude: "Amplitude",
  averageLuminance: "Average Luma",
  bias: "Bias",
  blendFunction: "Blend",
  blur: "Blur",
  bokehScale: "Bokeh Scale",
  brightness: "Brightness",
  cellSize: "Cell Size",
  characters: "Characters",
  chromaticAberrationOffset: "Chromatic Offset",
  color: "Color",
  columns: "Columns",
  contrast: "Contrast",
  damp: "Damp",
  darkness: "Darkness",
  delay: "Delay",
  density: "Density",
  depthAwareUpsampling: "Depth Upsampling",
  ditherScale: "Dither Scale",
  ditherStrength: "Dither Strength",
  dof: "DOF",
  dtSize: "Texture Size",
  duration: "Duration",
  edgeDetectionMode: "Edge Detection",
  edgeStrength: "Edge Strength",
  enabled: "Enabled",
  fade: "Fade",
  feather: "Feather",
  focus: "Focus",
  focusArea: "Focus Area",
  focusDistance: "Focus Distance",
  focusRange: "Focus Range",
  font: "Font",
  fontSize: "Font Size",
  gamma: "Gamma",
  granularity: "Granularity",
  hiddenEdgeColor: "Hidden Edge",
  hue: "Hue",
  intensity: "Intensity",
  invert: "Invert",
  inverted: "Inverted",
  kernelSize: "Kernel Size",
  legacy: "Legacy",
  levels: "Levels",
  lineWidth: "Line Width",
  luminanceInfluence: "Luma Influence",
  luminanceSmoothing: "Luma Smoothing",
  luminanceThreshold: "Luma Threshold",
  maxBlur: "Max Blur",
  maxLuminance: "Max Luma",
  maxRadius: "Max Radius",
  middleGrey: "Middle Grey",
  minLuminance: "Min Luma",
  minRadiusScale: "Min Radius",
  mipmapBlur: "Mipmap Blur",
  mode: "Mode",
  modulationOffset: "Modulation",
  multisampling: "Multisampling",
  offset: "Offset",
  palette: "Palette",
  predicationMode: "Predication",
  premultiply: "Premultiply",
  pulseSpeed: "Pulse Speed",
  radialModulation: "Radial Mod",
  radius: "Radius",
  ratio: "Ratio",
  resolution: "Resolution",
  resolutionScale: "Resolution Scale",
  resolutionX: "Resolution X",
  resolutionY: "Resolution Y",
  rings: "Rings",
  rotation: "Rotation",
  samples: "Samples",
  saturation: "Saturation",
  scale: "Scale",
  scrollSpeed: "Scroll Speed",
  speed: "Speed",
  start: "Start",
  strength: "Strength",
  taper: "Taper",
  threshold: "Threshold",
  thickness: "Thickness",
  tint: "Tint",
  visibleEdgeColor: "Visible Edge",
  wavelength: "Wavelength",
  whitePoint: "White Point",
  worldDistanceFalloff: "Distance Falloff",
  worldDistanceThreshold: "Distance Limit",
  worldFocusDistance: "World Focus",
  worldFocusRange: "World Range",
  worldProximityFalloff: "Proximity Falloff",
  worldProximityThreshold: "Proximity Limit",
  xRay: "X-Ray",
};

function controlLabel(key: string): string {
  return CONTROL_LABELS[key] ?? key;
}

function isColorValue(key: string, value: unknown): value is string {
  return (
    typeof value === "string" &&
    (key.toLowerCase().includes("color") || /^#[0-9a-f]{6}$/i.test(value))
  );
}

const EffectDetails = ({ uuid }: { uuid?: string }) => {
  const effects = useEffectsStore((state) => state.effects);
  const setEffect = useEffectsStore((state) => state.setEffect);

  const fields = useMemo(() => {
    const items: InspectorField[] = [];
    if (!uuid) return items;

    const effect = effects[uuid];
    if (!effect || !uuid) return items;

    items.push({
      kind: "readonly",
      label: "ID",
      value: uuid,
    });

    for (const key in effect) {
      if (key === "type") continue;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const value = effect[key];

      if (
        key === "blendFunction" ||
        key === "palette" ||
        key === "edgeDetectionMode" ||
        key === "predicationMode" ||
        key === "preset"
      ) {
        const options = OPTIONS_MAP[key];
        items.push({
          kind: "select",
          label: controlLabel(key),
          options,
          value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        });
      } else if (key === "scale" && effect.type === "grid") {
        items.push({
          kind: "number",
          label: controlLabel(key),
          min: 0,
          max: 1,
          step: 0.1,
          value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        });
      } else if (key === "mode") {
        const options = MODE_OPTIONS_MAP[effect.type];

        if (options) {
          items.push({
            kind: "select",
            label: controlLabel(key),
            options,
            value,
            onChange: (newValue: unknown) => {
              setEffect(uuid, { [key]: newValue } as never);
            },
          });
        }
      } else if (key === "fragmentShader") {
        items.push({
          kind: "button",
          label: controlLabel(key),
          action: () => {
            openShaderEditor(uuid);
          },
        });
      } else if (key === "brightness" || key === "contrast") {
        items.push({
          kind: "number",
          label: controlLabel(key),
          value,
          min: -1,
          max: 1,
          step: 0.01,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        });
      } else if (key === "damp") {
        items.push({
          kind: "number",
          label: controlLabel(key),
          value,
          min: 0,
          max: 0.99,
          step: 0.01,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        });
      } else if (typeof value === "number") {
        items.push({
          kind: "number",
          label: controlLabel(key),
          value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        });
      } else if (typeof value === "boolean") {
        items.push({
          kind: "boolean",
          label: controlLabel(key),
          value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        });
      } else if (isColorValue(key, value)) {
        items.push({
          kind: "color",
          label: controlLabel(key),
          value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        });
      } else if (typeof value === "string") {
        items.push({
          kind: "text",
          label: controlLabel(key),
          value,
          onChange: (newValue: unknown) => {
            setEffect(uuid, { [key]: newValue } as never);
          },
        });
      } else {
        items.push({
          kind: "readonly",
          label: controlLabel(key),
          value: JSON.stringify(value),
        });
      }
    }

    return items;
  }, [effects, uuid, setEffect]);

  return <InspectorPanel fields={fields} />;
};

const EffectContext = () => {
  const selected = useEffectsStore((state) => state.selected);

  return <EffectDetails uuid={selected} />;
};

function PresetsPanel() {
  const effects = useEffectsStore((state) => state.effects);
  const applyEffectsPreset = useEffectsStore(
    (state) => state.applyEffectsPreset,
  );
  const stackCount = Object.keys(effects).length;

  const onApplyPreset = (presetId: EffectPresetId, mode: "append" | "replace") => {
    if (mode === "append" || stackCount === 0) {
      applyEffectsPreset(presetId, mode);
      return;
    }

    confirm.delete("current effect stack", {
      onConfirm: () => applyEffectsPreset(presetId, mode),
    });
  };

  return (
    <div className="grid gap-2">
      {Object.values(EFFECT_PRESETS).map((preset) => (
        <section key={preset.id} className="rounded-md border bg-background p-3">
          <div className="flex items-start gap-2">
            <span className="rounded-md border bg-muted/30 p-1.5">
              <Wand2 size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium">{preset.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {preset.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {preset.effects.map((entry) => (
                  <span
                    key={`${preset.id}-${entry.type}`}
                    className="rounded border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {EFFECT_METADATA_BY_TYPE[entry.type].name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onApplyPreset(preset.id, "append")}
            >
              <Plus size={13} />
              Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onApplyPreset(preset.id, "replace")}
            >
              <RefreshCw size={13} />
              Replace
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}

function EffectBrowser() {
  const initEffect = useEffectsStore((state) => state.initEffect);
  const groupedEffects = useMemo(
    () =>
      EFFECT_CATEGORY_ORDER.map((category) => ({
        category,
        effects: EFFECT_METADATA.filter((effect) => effect.category === category),
      })),
    [],
  );

  return (
    <div className="grid gap-3">
      {groupedEffects.map(({ category, effects }) => (
        <section key={category} className="rounded-md border bg-background">
          <div className="border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
            {EFFECT_CATEGORY_LABELS[category]}
          </div>
          <div className="grid gap-1 p-2">
            {effects.map((effect) => (
              <Button
                key={effect.key}
                variant="ghost"
                className="h-auto justify-start px-2 py-2 text-left"
                onClick={() => initEffect(effect.key)}
              >
                <Plus size={13} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm">{effect.name}</span>
                  <span className="line-clamp-1 block text-xs font-normal text-muted-foreground">
                    {effect.description}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GuidancePanel() {
  const effects = useEffectsStore((state) => state.effects);
  const order = useEffectsStore((state) => state.order);
  const guidance = useMemo(
    () => getEffectGuidance(effects, order),
    [effects, order],
  );
  const iconByKind = {
    "normal-map": Info,
    reproducibility: AlertTriangle,
    performance: Zap,
  } as const;

  return (
    <div className="grid gap-2">
      {guidance.map((item) => {
        const Icon = iconByKind[item.kind];
        return (
          <div
            key={item.kind}
            className={cn(
              "rounded-md border px-3 py-2 text-xs",
              item.kind === "normal-map" &&
                "border-sky-500/25 bg-sky-500/10 text-sky-800",
              item.kind === "reproducibility" &&
                "border-amber-500/25 bg-amber-500/10 text-amber-800",
              item.kind === "performance" &&
                "border-violet-500/25 bg-violet-500/10 text-violet-800",
            )}
          >
            <div className="flex items-center gap-1.5 font-medium">
              <Icon size={13} />
              {item.title}
            </div>
            <p className="mt-1 opacity-80">{item.message}</p>
          </div>
        );
      })}
    </div>
  );
}

function DetailsPanel() {
  const selected = useEffectsStore((state) => state.selected);
  const effects = useEffectsStore((state) => state.effects);
  const effect = selected ? effects[selected] : undefined;
  const metadata = effect ? EFFECT_METADATA_BY_TYPE[effect.type] : undefined;

  if (!effect || !metadata) {
    return (
      <div className="grid min-h-48 place-items-center rounded-md border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
        Select an effect from the stack or add one from the browser.
      </div>
    );
  }

  return (
    <section className="min-h-0 rounded-md border bg-background">
      <div className="border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal size={14} />
          {metadata.name}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {metadata.description}
        </p>
      </div>
      <div className="min-h-64 overflow-visible">
        <EffectContext />
      </div>
    </section>
  );
}

export const EffectsTabs = () => {
  const effects = useEffectsStore((state) => state.effects);
  const order = useEffectsStore((state) => state.order);
  const selected = useEffectsStore((state) => state.selected);
  const selectedEffect = selected ? effects[selected] : undefined;
  const stackCount = getOrderedEffects(effects, order).length;
  const title = selectedEffect
    ? EFFECT_METADATA_BY_TYPE[selectedEffect.type].name
    : "No effect selected";

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <section className="shrink-0 rounded-md border bg-background p-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles size={14} />
              Effects Workbench
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {stackCount} effect{stackCount === 1 ? "" : "s"} in stack ·{" "}
              {title}
            </p>
          </div>
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Tabs defaultValue="details" className="grid gap-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="add">Add</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <GuidancePanel />

          <TabsContent value="presets" className="mt-0">
            <PresetsPanel />
          </TabsContent>
          <TabsContent value="add" className="mt-0">
            <EffectBrowser />
          </TabsContent>
          <TabsContent value="details" className="mt-0">
            <DetailsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
