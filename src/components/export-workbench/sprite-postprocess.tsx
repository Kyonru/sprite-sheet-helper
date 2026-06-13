import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  ImagePlus,
  Sparkles,
  Trash2,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSpritePostprocessStore } from "@/store/next/sprite-postprocess";
import type { ExportRow, AtlasOptions } from "@/types/file";
import type {
  SpritePostprocessEffect,
  SpritePostprocessEffectType,
  SpritePostprocessSnapshot,
} from "@/types/sprite-postprocess";
import { createAtlasPlan } from "@/utils/atlas";
import { applySpritePostprocessRows } from "@/utils/sprite-postprocess";

type SpritePreview = {
  sourceFrameURLs: string[];
  processedFrameURLs: string[];
  frameCount: number;
  pageCount: number;
};

const EFFECT_LABELS: Record<SpritePostprocessEffectType, string> = {
  outerOutline: "Outer Outline",
  dropShadow: "Drop Shadow",
  glow: "Glow",
  colorAdjust: "Color Adjust",
};

const EFFECT_SHORT_LABELS: Record<SpritePostprocessEffectType, string> = {
  outerOutline: "Outline",
  dropShadow: "Shadow",
  glow: "Glow",
  colorAdjust: "Color",
};

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-[10px] text-muted-foreground">
      {label}
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        className="h-7 text-xs"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-[10px] text-muted-foreground">
      {label}
      <span className="flex h-7 overflow-hidden rounded-md border bg-background">
        <Input
          type="color"
          value={value}
          className="h-7 w-8 rounded-none border-0 p-1"
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          value={value}
          className="h-7 rounded-none border-0 border-l text-xs"
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

function frameImageSrc(src: string) {
  return src.startsWith("data:") ? src : `data:image/png;base64,${src}`;
}

function loadPreviewImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load preview frame."));
    image.src = frameImageSrc(src);
  });
}

async function padPreviewFrame(
  src: string,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) return src;
  const image = await loadPreviewImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  context.imageSmoothingEnabled = false;
  context.drawImage(
    image,
    Math.round((targetWidth - sourceWidth) / 2),
    Math.round((targetHeight - sourceHeight) / 2),
    sourceWidth,
    sourceHeight,
  );
  return canvas.toDataURL("image/png");
}

async function alignSourceRowsToProcessedRows(
  rows: ExportRow[],
  processedRows: ExportRow[],
) {
  return Promise.all(
    rows.map(async (row, index) => {
      const processedRow = processedRows[index];
      if (!processedRow) return row;
      const images = await Promise.all(
        row.images.map((image) =>
          padPreviewFrame(
            image,
            row.frameWidth,
            row.frameHeight,
            processedRow.frameWidth,
            processedRow.frameHeight,
          ),
        ),
      );
      return {
        ...row,
        images,
        frameWidth: processedRow.frameWidth,
        frameHeight: processedRow.frameHeight,
      };
    }),
  );
}

function EffectControls({
  effect,
}: {
  effect: SpritePostprocessEffect;
}) {
  const updateEffect = useSpritePostprocessStore((state) => state.updateEffect);

  switch (effect.type) {
    case "outerOutline":
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <ColorInput
            label="Color"
            value={effect.color}
            onChange={(color) => updateEffect(effect.id, { color })}
          />
          <label className="grid gap-1 text-[10px] text-muted-foreground">
            Edge style
            <Select
              value={effect.outlineMode ?? "smooth"}
              onValueChange={(outlineMode) =>
                updateEffect(effect.id, {
                  outlineMode: outlineMode as "smooth" | "crisp",
                })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smooth">Smooth</SelectItem>
                <SelectItem value="crisp">Crisp Pixel</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <NumberInput
            label="Thickness"
            value={effect.thickness}
            min={0}
            max={24}
            onChange={(thickness) => updateEffect(effect.id, { thickness })}
          />
          <NumberInput
            label="Opacity"
            value={effect.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(opacity) => updateEffect(effect.id, { opacity })}
          />
        </div>
      );
    case "dropShadow":
      return (
        <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-3">
          <ColorInput
            label="Color"
            value={effect.color}
            onChange={(color) => updateEffect(effect.id, { color })}
          />
          <NumberInput
            label="Offset X"
            value={effect.offsetX}
            min={-64}
            max={64}
            onChange={(offsetX) => updateEffect(effect.id, { offsetX })}
          />
          <NumberInput
            label="Offset Y"
            value={effect.offsetY}
            min={-64}
            max={64}
            onChange={(offsetY) => updateEffect(effect.id, { offsetY })}
          />
          <NumberInput
            label="Blur"
            value={effect.blur}
            min={0}
            max={32}
            onChange={(blur) => updateEffect(effect.id, { blur })}
          />
          <NumberInput
            label="Spread"
            value={effect.spread}
            min={0}
            max={32}
            onChange={(spread) => updateEffect(effect.id, { spread })}
          />
          <NumberInput
            label="Opacity"
            value={effect.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(opacity) => updateEffect(effect.id, { opacity })}
          />
        </div>
      );
    case "glow":
      return (
        <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-3">
          <ColorInput
            label="Color"
            value={effect.color}
            onChange={(color) => updateEffect(effect.id, { color })}
          />
          <NumberInput
            label="Radius"
            value={effect.radius}
            min={0}
            max={48}
            onChange={(radius) => updateEffect(effect.id, { radius })}
          />
          <NumberInput
            label="Opacity"
            value={effect.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(opacity) => updateEffect(effect.id, { opacity })}
          />
        </div>
      );
    case "colorAdjust":
      return (
        <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-3">
          <NumberInput
            label="Brightness"
            value={effect.brightness}
            min={-100}
            max={100}
            onChange={(brightness) => updateEffect(effect.id, { brightness })}
          />
          <NumberInput
            label="Contrast"
            value={effect.contrast}
            min={-100}
            max={100}
            onChange={(contrast) => updateEffect(effect.id, { contrast })}
          />
          <NumberInput
            label="Saturation"
            value={effect.saturation}
            min={-100}
            max={100}
            onChange={(saturation) => updateEffect(effect.id, { saturation })}
          />
        </div>
      );
  }
}

export function SpritePostprocessWorkbench({
  rows,
  atlasOptions,
}: {
  rows: ExportRow[];
  atlasOptions: Partial<AtlasOptions>;
}) {
  const enabled = useSpritePostprocessStore((state) => state.enabled);
  const effects = useSpritePostprocessStore((state) => state.effects);
  const selectedRow = useSpritePostprocessStore((state) => state.selectedRow);
  const selectedFrame = useSpritePostprocessStore((state) => state.selectedFrame);
  const compareBeforeAfter = useSpritePostprocessStore(
    (state) => state.compareBeforeAfter,
  );
  const setEnabled = useSpritePostprocessStore((state) => state.setEnabled);
  const setSelectedRow = useSpritePostprocessStore((state) => state.setSelectedRow);
  const setCompareBeforeAfter = useSpritePostprocessStore(
    (state) => state.setCompareBeforeAfter,
  );
  const addEffect = useSpritePostprocessStore((state) => state.addEffect);
  const updateEffect = useSpritePostprocessStore((state) => state.updateEffect);
  const removeEffect = useSpritePostprocessStore((state) => state.removeEffect);
  const moveEffect = useSpritePostprocessStore((state) => state.moveEffect);
  const [collapsed, setCollapsed] = useState(true);

  const rowIndex = Math.min(selectedRow, Math.max(0, rows.length - 1));
  const row = rows[rowIndex];
  const frameIndex = row
    ? Math.min(selectedFrame, Math.max(0, row.images.length - 1))
    : 0;
  const settings = useMemo<SpritePostprocessSnapshot>(
    () => ({
      enabled,
      effects,
      selectedRow: rowIndex,
      selectedFrame: frameIndex,
      compareBeforeAfter,
    }),
    [compareBeforeAfter, effects, enabled, frameIndex, rowIndex],
  );
  const [preview, setPreview] = useState<SpritePreview | null>(null);
  const [status, setStatus] = useState("No processed preview yet.");
  const [previewZoom, setPreviewZoom] = useState(80);
  const [compareSplit, setCompareSplit] = useState(50);
  const [animationFrameIndex, setAnimationFrameIndex] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const isCollapsed = !enabled || collapsed;
  const handleEnabledChange = (value: boolean) => {
    setEnabled(value);
    setCollapsed(!value);
  };
  const setClampedPreviewZoom = (value: number) =>
    setPreviewZoom(Math.max(20, Math.min(400, Math.round(value))));
  const updateCompareSplitFromClientX = (clientX: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setCompareSplit(Math.max(0, Math.min(100, next)));
  };
  const startCompareDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateCompareSplitFromClientX(event.clientX);
    const handleMove = (moveEvent: PointerEvent) => {
      updateCompareSplitFromClientX(moveEvent.clientX);
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  useEffect(() => {
    let cancelled = false;
    async function buildPreview() {
      if (!row || row.images.length === 0) {
        setPreview(null);
        setStatus("Capture a sequence to preview sprite postprocessing.");
        return;
      }
      if (!enabled || effects.filter((effect) => effect.enabled).length === 0) {
        setPreview(null);
        setStatus("Enable postprocess and add an effect to see the processed preview.");
        return;
      }
      setStatus("Building processed preview...");
      try {
        const processedRows = await applySpritePostprocessRows(rows, settings);
        const alignedSourceRows = await alignSourceRowsToProcessedRows(
          rows,
          processedRows,
        );
        const plan = createAtlasPlan(processedRows, atlasOptions);
        const sourceFrameURLs = alignedSourceRows[rowIndex]?.images ?? [];
        const processedFrameURLs = processedRows[rowIndex]?.images ?? [];
        const frameCount = Math.min(
          sourceFrameURLs.length,
          processedFrameURLs.length,
        );
        if (cancelled) return;
        if (frameCount === 0) {
          setPreview(null);
          setStatus("Selected sequence has no frames on preview page 1.");
          return;
        }
        setPreview({
          sourceFrameURLs,
          processedFrameURLs,
          frameCount,
          pageCount: plan.pages.length,
        });
        setStatus("Processed preview ready.");
      } catch (error) {
        if (cancelled) return;
        setPreview(null);
        setStatus(error instanceof Error ? error.message : "Preview failed.");
      }
    }
    buildPreview();
    return () => {
      cancelled = true;
    };
  }, [atlasOptions, effects, enabled, row, rowIndex, rows, settings]);

  useEffect(() => {
    if (!preview || !row) return;
    let frame = 0;
    let animationFrame = 0;
    let lastTick = window.performance.now();
    const frameDuration = 1000 / Math.max(1, row.fps || 12);

    const tick = (now: number) => {
      if (now - lastTick >= frameDuration) {
        const steps = Math.floor((now - lastTick) / frameDuration);
        frame = (frame + steps) % Math.max(1, preview.frameCount);
        setAnimationFrameIndex(frame);
        lastTick += steps * frameDuration;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [preview, row]);

  const sourcePreviewFrame = preview?.sourceFrameURLs[animationFrameIndex];
  const processedPreviewFrame =
    preview?.processedFrameURLs[animationFrameIndex];

  return (
    <section className="mt-3 rounded-md border">
      <div className="flex items-start justify-between gap-2 border-b px-2.5 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
          disabled={!enabled}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span className="mt-0.5 text-muted-foreground">
            {isCollapsed ? (
              <ChevronRight size={13} />
            ) : (
              <ChevronDown size={13} />
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles size={14} />
              Spritesheet Postprocess
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Export-time 2D effects.
            </span>
          </span>
        </button>
        <Switch
          checked={enabled}
          onCheckedChange={(value) => handleEnabledChange(Boolean(value))}
        />
      </div>

      {!isCollapsed && (
      <div className="grid gap-2 p-2">
        <div className="grid gap-1.5 sm:grid-cols-[1fr_auto]">
          <Select
            value={String(rowIndex)}
            onValueChange={(value) => setSelectedRow(Number(value))}
            disabled={rows.length === 0}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Source sequence" />
            </SelectTrigger>
            <SelectContent>
              {rows.map((entry, index) => (
                <SelectItem key={entry.uuid} value={String(index)}>
                  {entry.label} · {entry.images.length} frames
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={compareBeforeAfter ? "secondary" : "outline"}
            className="h-7 text-xs"
            onClick={() => setCompareBeforeAfter(!compareBeforeAfter)}
          >
            <Eye size={14} />
            Before / After
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              "outerOutline",
              "dropShadow",
              "glow",
              "colorAdjust",
            ] satisfies SpritePostprocessEffectType[]
          ).map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 justify-center px-2 text-xs"
              onClick={() => addEffect(type)}
            >
              <ImagePlus size={14} />
              {EFFECT_SHORT_LABELS[type]}
            </Button>
          ))}
        </div>

        <div className="grid gap-1.5">
          {effects.length === 0 ? (
            <div className="rounded-md border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">
              Add an effect to create an export-time sprite polish stack.
            </div>
          ) : (
            effects.map((effect, index) => (
              <div
                key={effect.id}
                className={cn(
                  "rounded-md border bg-background p-2",
                  !effect.enabled && "opacity-60",
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Switch
                        checked={effect.enabled}
                        onCheckedChange={(value) =>
                          updateEffect(effect.id, { enabled: Boolean(value) })
                        }
                      />
                      {EFFECT_LABELS[effect.type]}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={index === 0}
                      onClick={() => moveEffect(effect.id, -1)}
                    >
                      <ArrowUp size={13} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={index === effects.length - 1}
                      onClick={() => moveEffect(effect.id, 1)}
                    >
                      <ArrowDown size={13} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => removeEffect(effect.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
                <EffectControls effect={effect} />
              </div>
            ))
          )}
        </div>

        <div className="rounded-md border bg-muted/20 p-2">
          <div
            ref={previewRef}
            className="relative min-h-44 overflow-hidden rounded-md border bg-checkerboard"
          >
            <div className="absolute left-1/2 top-1.5 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border bg-background/90 p-0.5 shadow-sm backdrop-blur">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6 rounded-full"
                onClick={() => setClampedPreviewZoom(previewZoom - 20)}
              >
                -
              </Button>
              <div className="flex min-w-14 items-center justify-center gap-1 px-1 text-[10px] font-medium tabular-nums">
                <ZoomIn size={12} />
                {previewZoom}%
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6 rounded-full"
                onClick={() => setClampedPreviewZoom(previewZoom + 20)}
              >
                +
              </Button>
            </div>
            {preview && row ? (
              <>
                {compareBeforeAfter && (
                  <img
                    src={frameImageSrc(sourcePreviewFrame ?? "")}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]"
                    style={{ transform: `scale(${previewZoom / 100})` }}
                  />
                )}
                <div
                  className={cn(
                    "absolute inset-0",
                    compareBeforeAfter && "overflow-hidden",
                  )}
                  style={
                    compareBeforeAfter
                      ? { clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }
                      : undefined
                  }
                >
                  <img
                    src={frameImageSrc(processedPreviewFrame ?? "")}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain [image-rendering:pixelated]"
                    style={{ transform: `scale(${previewZoom / 100})` }}
                  />
                </div>
                {compareBeforeAfter && (
                  <>
                    <div
                      className="absolute inset-y-0 z-10 w-8 -translate-x-1/2 cursor-ew-resize touch-none"
                      style={{ left: `${compareSplit}%` }}
                      onPointerDown={startCompareDrag}
                      role="slider"
                      aria-label="Before after compare split"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(compareSplit)}
                    />
                    <div
                      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                      style={{ left: `${compareSplit}%` }}
                    />
                    <div
                      className="pointer-events-none absolute top-1/2 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-background shadow-sm"
                      style={{ left: `${compareSplit}%` }}
                    />
                    <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-between text-[10px] font-medium uppercase tracking-wide">
                      <span className="rounded bg-background/85 px-1.5 py-0.5">
                        After
                      </span>
                      <span className="rounded bg-background/85 px-1.5 py-0.5">
                        Before
                      </span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex h-40 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                {status}
              </div>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground">
            {status}
            {preview && preview.pageCount > 1 && (
              <span className="ml-2 text-amber-600">
                Showing page 1. Export still processes all pages.
              </span>
            )}
          </div>
        </div>
      </div>
      )}
    </section>
  );
}
