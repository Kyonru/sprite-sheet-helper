import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  Film,
  ImageIcon,
  Layers,
  Play,
  Plus,
  RotateCcw,
  SquareStack,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { EventType, PubSub } from "@/lib/events";
import { useImagesStore } from "@/store/next/images";
import { useSettingsStore } from "@/store/next/settings";
import type { ExportFormat } from "@/types/file";
import { exporters } from "@/utils/exports";
import { DEFAULT_ATLAS_OPTIONS, atlasPageFileName } from "@/utils/atlas";
import {
  getExportSummary,
  validateExportRequest,
  type ExportValidationMessage,
} from "@/utils/export-validation";
import {
  clearExportHistory,
  loadExportHistory,
  type ExportHistoryEntry,
} from "@/utils/export-history";
import { SequencePreview } from "./export-workbench/sequence-preview";

const FORMAT_NOTES: Partial<
  Record<ExportFormat, { category: string; note: string }>
> = {
  spritesheet: {
    category: "Generic atlas",
    note: "Best for custom engines and multi-page JSON exports.",
  },
  zip: {
    category: "Raw frames",
    note: "Exports individual captured frames; atlas settings do not apply.",
  },
  gif: {
    category: "Animation",
    note: "Creates animated GIF output; normal maps are not emitted.",
  },
  phaser: {
    category: "Engine package",
    note: "Generates Phaser atlas JSON and helper TypeScript.",
  },
  bevy: {
    category: "Engine package",
    note: "Generates Bevy sprite rects and a starter plugin.",
  },
  godot: {
    category: "Engine package",
    note: "Packages Godot atlas metadata and helper files.",
  },
  unity: {
    category: "Engine package",
    note: "Generates Unity sprite metadata and setup notes.",
  },
  "love2d-lua": {
    category: "Engine package",
    note: "Generates Lua quads for LÖVE 2D.",
  },
  "love2d-anim8": {
    category: "Engine package",
    note: "Generates anim8-friendly Lua helpers.",
  },
  turbo: {
    category: "Engine package",
    note: "Generates Turbo Rust spritesheet helpers.",
  },
  pygame: {
    category: "Engine package",
    note: "Generates Python loader helpers.",
  },
  raylib: {
    category: "Engine package",
    note: "Generates C header metadata for raylib.",
  },
};

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon size={13} />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ValidationMessages({
  messages,
}: {
  messages: ExportValidationMessage[];
}) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
        <CheckCircle2 size={14} />
        Export checks look good.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {messages.map((message, index) => (
        <div
          key={`${message.severity}-${index}`}
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
            message.severity === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700",
          )}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{message.message}</span>
        </div>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function ExportWorkbench() {
  const rows = useImagesStore((state) => state.images);
  const intervals = useImagesStore((state) => state.intervals);
  const iterations = useImagesStore((state) => state.iterations);
  const fps = useImagesStore((state) => state.fps);
  const setIntervals = useImagesStore((state) => state.setIntervals);
  const setIterations = useImagesStore((state) => state.setIterations);
  const setFPS = useImagesStore((state) => state.setFPS);

  const mode = useSettingsStore((state) => state.mode);
  const setMode = useSettingsStore((state) => state.setMode);
  const exportWidth = useSettingsStore((state) => state.exportWidth);
  const exportHeight = useSettingsStore((state) => state.exportHeight);
  const setExportWidth = useSettingsStore((state) => state.setExportWidth);
  const setExportHeight = useSettingsStore((state) => state.setExportHeight);
  const exportNormalMap = useSettingsStore((state) => state.exportNormalMap);
  const setExportNormalMap = useSettingsStore(
    (state) => state.setExportNormalMap,
  );
  const atlasLayout = useSettingsStore((state) => state.atlasLayout);
  const atlasPadding = useSettingsStore((state) => state.atlasPadding);
  const atlasBleed = useSettingsStore((state) => state.atlasBleed);
  const atlasScale = useSettingsStore((state) => state.atlasScale);
  const maxAtlasSize = useSettingsStore((state) => state.maxAtlasSize);
  const allowMultiPage = useSettingsStore((state) => state.allowMultiPage);
  const setAtlasOptions = useSettingsStore((state) => state.setAtlasOptions);

  const [preflightOpen, setPreflightOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<ExportHistoryEntry[]>(() =>
    loadExportHistory(),
  );

  const atlasOptions = useMemo(
    () => ({
      layout: atlasLayout,
      padding: atlasPadding,
      extrude: atlasBleed,
      scale: atlasScale,
      maxAtlasSize,
      allowMultiPage,
    }),
    [
      allowMultiPage,
      atlasBleed,
      atlasLayout,
      atlasPadding,
      atlasScale,
      maxAtlasSize,
    ],
  );
  const validation = useMemo(
    () =>
      validateExportRequest({
        rows,
        format: mode,
        includeNormalMap: exportNormalMap,
        atlasOptions,
      }),
    [atlasOptions, exportNormalMap, mode, rows],
  );
  const summary = useMemo(
    () => getExportSummary(rows, atlasOptions),
    [atlasOptions, rows],
  );
  const selectedExporter = exporters[mode];
  const selectedNote = FORMAT_NOTES[mode];

  useEffect(() => {
    const onStopExport = () => {
      setExporting(false);
      setHistory(loadExportHistory());
    };
    PubSub.on(EventType.STOP_EXPORT, onStopExport);
    return () => {
      PubSub.off(EventType.STOP_EXPORT, onStopExport);
    };
  }, []);

  const startExport = () => {
    setExporting(true);
    PubSub.emit(EventType.START_EXPORT, {
      format: mode,
      atlasOptions,
    });
    setPreflightOpen(false);
  };

  const outputFiles = validation.plan?.pages.map((page) =>
    atlasPageFileName("spritesheet.png", page.index),
  ) ?? ["spritesheet.png"];

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <FileArchive size={17} />
          <h2 className="text-sm font-semibold">Export Workbench</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Review captures, prepare atlas output, and package engine files.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <section className="grid grid-cols-2 gap-2">
          <Stat label="Sequences" value={summary.animationCount} icon={Film} />
          <Stat label="Frames" value={summary.frameCount} icon={ImageIcon} />
          <Stat
            label="Pages"
            value={summary.pageCount || "-"}
            icon={SquareStack}
          />
          <Stat
            label="Frame"
            value={`${exportWidth}x${exportHeight}`}
            icon={Boxes}
          />
        </section>

        <section className="mt-3 rounded-md border">
          <div className="border-b px-3 py-2 text-sm font-medium">
            Capture
          </div>
          <div className="grid gap-2 p-3">
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Frame interval ms"
                value={intervals}
                min={1}
                onChange={setIntervals}
              />
              <NumberField
                label="Frames"
                value={iterations}
                min={1}
                onChange={setIterations}
              />
              <NumberField
                label="Frame duration"
                value={fps}
                min={1}
                onChange={setFPS}
              />
              <NumberField
                label="Width"
                value={exportWidth}
                min={1}
                onChange={setExportWidth}
              />
              <NumberField
                label="Height"
                value={exportHeight}
                min={1}
                onChange={setExportHeight}
              />
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              Capture normal maps
              <Switch
                checked={exportNormalMap}
                onCheckedChange={(checked) =>
                  setExportNormalMap(Boolean(checked))
                }
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => PubSub.emit(EventType.START_ASSETS_CREATION)}
              >
                <Play size={14} />
                Record
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => PubSub.emit(EventType.TAKE_SINGLE_SCREENSHOT)}
              >
                <Plus size={14} />
                Frame
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => PubSub.emit(EventType.NEW_SEQUENCE)}
              >
                <Layers size={14} />
                Row
              </Button>
            </div>
          </div>
        </section>

        <SequencePreview />

        <section className="mt-3 rounded-md border">
          <div className="border-b px-3 py-2 text-sm font-medium">Output</div>
          <div className="grid gap-2 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Format</span>
              <span className="font-medium">{selectedExporter.label}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Layout</span>
              <span className="capitalize">{atlasLayout}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Normal maps</span>
              <span className="capitalize">{summary.normalStatus}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Atlas</span>
              <span>
                {summary.imageWidth}x{summary.imageHeight}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-3">
          <ValidationMessages messages={validation.messages.slice(0, 3)} />
        </section>

        <section className="mt-3 rounded-md border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Recent Exports</span>
            <Button
              size="icon"
              variant="ghost"
              title="Clear export history"
              onClick={() => setHistory(clearExportHistory())}
              disabled={history.length === 0}
            >
              <RotateCcw size={14} />
            </Button>
          </div>
          <div className="grid gap-2 p-3">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Successful exports will appear here.
              </p>
            ) : (
              history.slice(0, 5).map((entry) => (
                <div key={entry.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium">
                      {entry.filename}
                    </span>
                    <span className="text-muted-foreground">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {entry.format} · {entry.frameCount} frames ·{" "}
                    {entry.pageCount} page{entry.pageCount === 1 ? "" : "s"}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <footer className="border-t p-3">
        <Button
          className="w-full gap-2"
          onClick={() => setPreflightOpen(true)}
          disabled={exporting}
        >
          <Download size={15} />
          {exporting ? "Exporting" : "Prepare Export"}
        </Button>
      </footer>

      <Dialog open={preflightOpen} onOpenChange={setPreflightOpen}>
        <DialogContent className="flex h-[90vh] max-w-[92vw] flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>Export Preflight</DialogTitle>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,360px)_1fr] overflow-hidden">
            <aside className="min-h-0 overflow-auto border-r p-3">
              <Label className="text-xs text-muted-foreground">Format</Label>
              <div className="mt-2 grid gap-2">
                {Object.values(exporters).map((exporter) => {
                  const note = FORMAT_NOTES[exporter.id];
                  return (
                    <button
                      key={exporter.id}
                      type="button"
                      onClick={() => setMode(exporter.id)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-left transition-colors",
                        mode === exporter.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <span className="block text-sm font-medium">
                        {exporter.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {note?.category ?? "Exporter"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="min-h-0 overflow-auto p-4">
              <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
                <section className="rounded-md border">
                  <div className="border-b px-3 py-2 text-sm font-medium">
                    Atlas Settings
                  </div>
                  <div className="grid gap-3 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={atlasLayout === "rows" ? "secondary" : "outline"}
                        onClick={() => setAtlasOptions({ layout: "rows" })}
                      >
                        Rows / compatible
                      </Button>
                      <Button
                        type="button"
                        variant={
                          atlasLayout === "packed" ? "secondary" : "outline"
                        }
                        onClick={() => setAtlasOptions({ layout: "packed" })}
                      >
                        Packed / production
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <NumberField
                        label="Padding"
                        value={atlasPadding}
                        onChange={(value) =>
                          setAtlasOptions({ padding: value })
                        }
                      />
                      <NumberField
                        label="Bleed"
                        value={atlasBleed}
                        onChange={(value) =>
                          setAtlasOptions({ extrude: value })
                        }
                      />
                      <NumberField
                        label="Scale"
                        value={atlasScale}
                        min={0.1}
                        step={0.1}
                        onChange={(value) => setAtlasOptions({ scale: value })}
                      />
                      <NumberField
                        label="Max atlas"
                        value={maxAtlasSize}
                        min={1}
                        onChange={(value) =>
                          setAtlasOptions({ maxAtlasSize: value })
                        }
                      />
                    </div>
                    <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      Allow multi-page atlas
                      <Switch
                        checked={allowMultiPage}
                        onCheckedChange={(checked) =>
                          setAtlasOptions({ allowMultiPage: Boolean(checked) })
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-md border">
                  <div className="border-b px-3 py-2 text-sm font-medium">
                    Selected Exporter
                  </div>
                  <div className="grid gap-3 p-3 text-sm">
                    <div>
                      <div className="font-medium">{selectedExporter.label}</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedNote?.note ?? "Packages captured frames."}
                      </p>
                    </div>
                    <div className="rounded-md border px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <Clock size={13} />
                        Output preview
                      </div>
                      <div className="mt-2 grid gap-1 text-muted-foreground">
                        {outputFiles.slice(0, 4).map((file) => (
                          <span key={file}>{file}</span>
                        ))}
                        {outputFiles.length > 4 && (
                          <span>+ {outputFiles.length - 4} more pages</span>
                        )}
                        <span>spritesheet.json</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md border px-2 py-2">
                        <span className="block text-muted-foreground">
                          Pages
                        </span>
                        <span className="text-lg font-semibold">
                          {summary.pageCount}
                        </span>
                      </div>
                      <div className="rounded-md border px-2 py-2">
                        <span className="block text-muted-foreground">
                          Frames
                        </span>
                        <span className="text-lg font-semibold">
                          {summary.frameCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="xl:col-span-2">
                  <ValidationMessages messages={validation.messages} />
                </section>
              </div>
            </main>
          </div>
          <footer className="flex items-center justify-between border-t px-4 py-3">
            <Button
              variant="outline"
              onClick={() =>
                setAtlasOptions({
                  layout: DEFAULT_ATLAS_OPTIONS.layout,
                  padding: DEFAULT_ATLAS_OPTIONS.padding,
                  extrude: DEFAULT_ATLAS_OPTIONS.extrude,
                  scale: DEFAULT_ATLAS_OPTIONS.scale,
                  maxAtlasSize: DEFAULT_ATLAS_OPTIONS.maxAtlasSize,
                  allowMultiPage: DEFAULT_ATLAS_OPTIONS.allowMultiPage,
                })
              }
            >
              Reset atlas
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreflightOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={startExport}
                disabled={validation.blocking || exporting}
              >
                <Download size={14} />
                Export
              </Button>
            </div>
          </footer>
        </DialogContent>
      </Dialog>
    </div>
  );
}
