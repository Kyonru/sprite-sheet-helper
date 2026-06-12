import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Code2,
  Download,
  FileArchive,
  FileJson,
  Film,
  Gamepad2,
  Grid2X2,
  ImageIcon,
  Layers,
  ListChecks,
  Package,
  Play,
  Plus,
  Settings2,
  SquareStack,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EventType, PubSub } from "@/lib/events";
import { useImagesStore } from "@/store/next/images";
import { useSettingsStore } from "@/store/next/settings";
import type { ExportFormat, ExportRow } from "@/types/file";
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

const FORMAT_ICONS: Record<ExportFormat, LucideIcon> = {
  spritesheet: SquareStack,
  zip: FileArchive,
  gif: Film,
  phaser: Gamepad2,
  bevy: Package,
  godot: Package,
  unity: Package,
  "love2d-lua": Gamepad2,
  "love2d-anim8": Gamepad2,
  turbo: Code2,
  pygame: Code2,
  raylib: Code2,
};

type FormatLogo = {
  light: string;
  dark?: string;
};

const FORMAT_LOGOS: Partial<Record<ExportFormat, FormatLogo>> = {
  phaser: { light: "/phaser.png" },
  bevy: { light: "/bevy.svg" },
  godot: { light: "/godot.svg" },
  unity: { light: "/unity.svg", dark: "/unity_dark.svg" },
  "love2d-lua": { light: "/love.svg" },
  "love2d-anim8": { light: "/love.svg" },
  turbo: { light: "/turbo.svg" },
  pygame: { light: "/pygame.svg" },
  raylib: { light: "/raylib.png" },
};

function getFormatLogo(format: ExportFormat, theme: "light" | "dark") {
  const logo = FORMAT_LOGOS[format];
  if (!logo) return undefined;
  return theme === "dark" && logo.dark ? logo.dark : logo.light;
}

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

function MiniStat({
  label,
  value,
  icon: Icon,
  logo,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  logo?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
        {logo ? (
          <img
            src={logo}
            alt=""
            aria-hidden="true"
            className="size-3.5 shrink-0 object-contain"
            draggable={false}
          />
        ) : (
          Icon && <Icon size={12} className="shrink-0" />
        )}
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function SectionShell({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          {Icon && (
            <span className="mt-0.5 rounded-md border bg-muted/30 p-1">
              <Icon size={14} />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-medium">{title}</h3>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function OutputFileIcon({ file }: { file: string }) {
  const Icon = file.endsWith(".json")
    ? FileJson
    : file.endsWith(".gif")
      ? Film
      : file.endsWith(".png") || file.includes("*.png")
        ? ImageIcon
        : /\.(ts|rs|lua|gd|py|h|c|cs)$/.test(file) ||
            file.endsWith(".toml.snippet")
          ? Code2
          : FileArchive;

  return <Icon size={13} className="shrink-0" />;
}

function FormatMark({
  format,
  selected,
  theme,
  compact = false,
}: {
  format: ExportFormat;
  selected: boolean;
  theme: "light" | "dark";
  compact?: boolean;
}) {
  const logo = getFormatLogo(format, theme);
  const Icon = FORMAT_ICONS[format];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border",
        compact ? "size-6" : "size-8",
        selected
          ? "border-primary/30 bg-primary/15"
          : "bg-muted/30 text-muted-foreground",
      )}
    >
      {logo ? (
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className={cn("object-contain", compact ? "size-4" : "size-5")}
          draggable={false}
        />
      ) : (
        <Icon size={compact ? 14 : 16} />
      )}
    </span>
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
  inputTestId,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  inputTestId?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
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

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getPreflightOutputFiles({
  format,
  rows,
  atlasFiles,
  normalFiles,
}: {
  format: ExportFormat;
  rows: ExportRow[];
  atlasFiles: string[];
  normalFiles: string[];
}) {
  const colorAtlasFiles =
    atlasFiles.length > 0 ? atlasFiles : ["spritesheet.png"];
  const genericAtlasFiles = [
    ...colorAtlasFiles,
    ...normalFiles,
    "spritesheet.json",
    "spritesheet.manifest.json",
  ];
  const singlePageNormalFiles = normalFiles.slice(0, 1);

  switch (format) {
    case "zip": {
      const frameFiles = rows.flatMap((row) =>
        row.images.map((_, index) => `${row.label}/${row.uuid}_${index}.png`),
      );
      return frameFiles.length > 0 ? frameFiles : ["<sequence>/<frame>.png"];
    }
    case "gif": {
      const gifFiles = rows.map((row) => `${row.label}.gif`);
      return gifFiles.length > 0 ? gifFiles : ["<sequence>.gif"];
    }
    case "spritesheet":
      return genericAtlasFiles;
    case "phaser":
      return [
        "spritesheet.png",
        ...singlePageNormalFiles,
        "spritesheet_atlas.json",
        "spritesheet.manifest.json",
        "spritesheet_phaser.ts",
        "example.ts",
      ];
    case "bevy":
      return [
        "assets/spritesheet.png",
        ...singlePageNormalFiles.map((file) => `assets/${file}`),
        "assets/spritesheet.manifest.json",
        "src/spritesheet.rs",
        "src/main.rs",
        "Cargo.toml.snippet",
      ];
    case "godot":
      return [
        "spritesheet.png",
        ...singlePageNormalFiles,
        "spritesheet.manifest.json",
        "SpriteSheetHelper.gd",
        "ExamplePlayer.gd",
      ];
    case "love2d-lua":
    case "love2d-anim8":
      return [
        "spritesheet.png",
        ...singlePageNormalFiles,
        "spritesheet.json",
        "spritesheet.manifest.json",
        "spritesheet.lua",
        "main.lua",
      ];
    case "turbo":
      return [
        "spritesheet.png",
        ...singlePageNormalFiles,
        "spritesheet.json",
        "spritesheet.manifest.json",
        "spritesheet_turbo.rs",
        "example.rs",
      ];
    case "pygame":
      return [
        "spritesheet.png",
        ...singlePageNormalFiles,
        "spritesheet.manifest.json",
        "spritesheet.py",
        "main.py",
      ];
    case "raylib":
      return [
        "spritesheet.png",
        ...singlePageNormalFiles,
        "spritesheet.manifest.json",
        "spritesheet.h",
        "main.c",
      ];
    case "unity":
      return [
        "spritesheet.png",
        ...singlePageNormalFiles,
        "spritesheet.manifest.json",
        "SpriteSheetAnimator.cs",
        "ExamplePlayer.cs",
      ];
  }
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
  const theme = useSettingsStore((state) => state.theme);
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
  const [isRecording, setIsRecording] = useState(false);
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
  const blockingCount = validation.messages.filter(
    (message) => message.severity === "error",
  ).length;
  const warningCount = validation.messages.filter(
    (message) => message.severity === "warning",
  ).length;
  const preflightStatus = validation.blocking
    ? "Needs fixes"
    : warningCount > 0
      ? "Warnings"
      : "Ready";

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

  useEffect(() => {
    const onStartAssetsCreation = () => {
      setIsRecording(true);
    };

    const onStopAssetsCreation = () => {
      setIsRecording(false);
    };

    PubSub.on(EventType.START_ASSETS_CREATION, onStartAssetsCreation);
    PubSub.on(EventType.STOP_ASSETS_CREATION, onStopAssetsCreation);
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, onStartAssetsCreation);
      PubSub.off(EventType.STOP_ASSETS_CREATION, onStopAssetsCreation);
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

  const atlasFiles =
    validation.plan?.pages.map((page) =>
      atlasPageFileName("spritesheet.png", page.index),
    ) ?? [];
  const normalFiles =
    exportNormalMap && validation.plan
      ? validation.plan.pages.map((page) =>
          atlasPageFileName("spritesheet_normal.png", page.index),
        )
      : [];
  const outputFiles = getPreflightOutputFiles({
    format: mode,
    rows,
    atlasFiles,
    normalFiles,
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <FileArchive size={17} />
          <h2 className="text-sm font-semibold">Export Workbench</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Review captures, prepare atlas output, and package engine files.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
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
          <div className="border-b px-3 py-2 text-sm font-medium">Capture</div>
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
                disabled={isRecording}
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
              <Trash2Icon size={14} />
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

      <footer className="shrink-0 border-t p-3">
        <Button
          className="w-full gap-2"
          data-testid="prepare-export-button"
          onClick={() => setPreflightOpen(true)}
          disabled={exporting}
        >
          <Download size={15} />
          {exporting ? "Exporting" : "Prepare Export"}
        </Button>
      </footer>

      <Dialog open={preflightOpen} onOpenChange={setPreflightOpen}>
        <DialogContent className="flex h-[min(92vh,900px)] w-[calc(100vw-1rem)] max-w-[1600px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-1rem)] 2xl:max-w-[1600px] z-999">
          <DialogHeader className="border-b px-5 py-4 pe-12">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="flex items-center gap-2">
                <FileArchive size={18} />
                Export Preflight
              </DialogTitle>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-medium",
                  validation.blocking
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : warningCount > 0
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
                )}
              >
                {preflightStatus}
              </span>
            </div>
            <DialogDescription>
              Choose the exporter, check atlas settings, then confirm the files
              that will be created.
            </DialogDescription>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <MiniStat
                label="Format"
                value={selectedExporter.label}
                icon={FORMAT_ICONS[mode]}
                logo={getFormatLogo(mode, theme)}
              />
              <MiniStat
                label="Frames"
                value={summary.frameCount}
                icon={ImageIcon}
              />
              <MiniStat
                label="Sequences"
                value={summary.animationCount}
                icon={Film}
              />
              <MiniStat
                label="Atlas"
                value={
                  summary.imageWidth > 0
                    ? `${summary.imageWidth}x${summary.imageHeight}`
                    : "-"
                }
                icon={SquareStack}
              />
              <MiniStat
                label="Checks"
                value={
                  blockingCount > 0
                    ? `${blockingCount} blocking`
                    : warningCount > 0
                      ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
                      : "Clear"
                }
                icon={validation.blocking ? AlertTriangle : CheckCircle2}
              />
            </div>
          </DialogHeader>
          <main className="min-h-0 flex-1 overflow-auto bg-muted/20 p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid min-w-0 gap-4">
                <SectionShell
                  title="Format"
                  description="Pick the package shape for this export."
                  icon={Package}
                  action={
                    <Select
                      value={mode}
                      onValueChange={(value) => setMode(value as ExportFormat)}
                    >
                      <SelectTrigger size="sm" className="w-[190px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(exporters).map((exporter) => (
                          <SelectItem key={exporter.id} value={exporter.id}>
                            <span className="flex items-center gap-2">
                              <FormatMark
                                format={exporter.id}
                                selected={mode === exporter.id}
                                theme={theme}
                                compact
                              />
                              {exporter.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                >
                  <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                    {Object.values(exporters).map((exporter) => {
                      const note = FORMAT_NOTES[exporter.id];
                      const selected = mode === exporter.id;
                      return (
                        <button
                          key={exporter.id}
                          type="button"
                          data-testid={`export-format-${exporter.id}`}
                          onClick={() => setMode(exporter.id)}
                          className={cn(
                            "min-h-20 rounded-md border px-3 py-2.5 text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "bg-background hover:bg-muted",
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <FormatMark
                                format={exporter.id}
                                selected={selected}
                                theme={theme}
                              />
                              <span className="truncate text-sm font-medium">
                                {exporter.label}
                              </span>
                            </span>
                            {selected && (
                              <CheckCircle2 size={14} className="shrink-0" />
                            )}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {note?.category ?? "Exporter"}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                            {note?.note ?? "Packages captured frames."}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </SectionShell>

                <SectionShell
                  title="Atlas Settings"
                  description="Rows keeps legacy layout; packed reduces empty space."
                  icon={Settings2}
                >
                  <div className="grid gap-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Button
                        type="button"
                        data-testid="atlas-layout-rows-button"
                        variant={
                          atlasLayout === "rows" ? "secondary" : "outline"
                        }
                        className="h-auto justify-start px-3 py-2 text-left"
                        onClick={() => setAtlasOptions({ layout: "rows" })}
                      >
                        <Layers size={16} className="shrink-0" />
                        <span>
                          <span className="block text-sm">
                            Rows / compatible
                          </span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            Preserves sequence rows and frame order.
                          </span>
                        </span>
                      </Button>
                      <Button
                        type="button"
                        data-testid="atlas-layout-packed-button"
                        variant={
                          atlasLayout === "packed" ? "secondary" : "outline"
                        }
                        className="h-auto justify-start px-3 py-2 text-left"
                        onClick={() => setAtlasOptions({ layout: "packed" })}
                      >
                        <Grid2X2 size={16} className="shrink-0" />
                        <span>
                          <span className="block text-sm">
                            Packed / production
                          </span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            Deterministic packing without frame rotation.
                          </span>
                        </span>
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <NumberField
                        label="Padding"
                        value={atlasPadding}
                        inputTestId="atlas-padding-input"
                        onChange={(value) =>
                          setAtlasOptions({ padding: value })
                        }
                      />
                      <NumberField
                        label="Extrude"
                        value={atlasBleed}
                        inputTestId="atlas-extrude-input"
                        onChange={(value) =>
                          setAtlasOptions({ extrude: value })
                        }
                      />
                      <NumberField
                        label="Max atlas"
                        value={maxAtlasSize}
                        min={1}
                        inputTestId="atlas-max-size-input"
                        onChange={(value) =>
                          setAtlasOptions({ maxAtlasSize: value })
                        }
                      />
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">
                            Atlas scale
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Export at common pixel scales or enter a custom
                            multiplier.
                          </p>
                        </div>
                        <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium">
                          {atlasScale}x
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_110px]">
                        {[1, 2, 4].map((scale) => (
                          <Button
                            key={scale}
                            type="button"
                            data-testid={`atlas-scale-${scale}x-button`}
                            variant={
                              atlasScale === scale ? "secondary" : "outline"
                            }
                            size="sm"
                            onClick={() => setAtlasOptions({ scale })}
                          >
                            {scale}x
                          </Button>
                        ))}
                        <Input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={atlasScale}
                          aria-label="Custom atlas scale"
                          onChange={(event) =>
                            setAtlasOptions({
                              scale: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <SquareStack
                          size={15}
                          className="mt-0.5 shrink-0 text-muted-foreground"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            Allow multi-page atlas
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Generic spritesheet supports pages now; engine
                            exporters block unsafe multi-page output.
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={allowMultiPage}
                        onCheckedChange={(checked) =>
                          setAtlasOptions({ allowMultiPage: Boolean(checked) })
                        }
                      />
                    </div>
                  </div>
                </SectionShell>
              </div>

              <aside className="grid min-w-0 gap-4 xl:sticky xl:top-0 xl:self-start">
                <SectionShell title="Output Preview" icon={FileArchive}>
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <FormatMark format={mode} selected={true} theme={theme} />
                      <div className="min-w-0">
                        <div className="font-medium">
                          {selectedExporter.label}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedNote?.note ?? "Packages captured frames."}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <Clock size={13} />
                        Files ({outputFiles.length})
                      </div>
                      <div className="mt-2 grid max-h-44 gap-1 overflow-auto text-muted-foreground">
                        {outputFiles.map((file) => (
                          <span
                            key={file}
                            className="flex items-center gap-2 truncate"
                          >
                            <OutputFileIcon file={file} />
                            <span className="truncate">{file}</span>
                          </span>
                        ))}
                      </div>
                      {validation.blocking && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-destructive">
                          <AlertTriangle size={13} className="mt-0.5" />
                          <span>
                            Export is blocked until validation errors are fixed.
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-muted/40 px-2 py-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <SquareStack size={12} />
                          Pages
                        </span>
                        <span className="text-lg font-semibold">
                          {summary.pageCount}
                        </span>
                      </div>
                      <div className="rounded-md bg-muted/40 px-2 py-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <ImageIcon size={12} />
                          Frames
                        </span>
                        <span className="text-lg font-semibold">
                          {summary.frameCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </SectionShell>

                <SectionShell title="Validation" icon={ListChecks}>
                  <ValidationMessages messages={validation.messages} />
                </SectionShell>
              </aside>
            </div>
          </main>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-background px-4 py-3">
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
                data-testid="preflight-export-button"
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
