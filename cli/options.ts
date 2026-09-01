import { access, readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  ACCEPTED_MODEL_FILE_TYPES,
  EXPORT_FORMATS,
  WORKFLOW_PRESETS,
  type ExportFormat,
} from "./data.js";
import type {
  CliAtlasOptions,
  CliCaptureSettings,
  CliCaptureSettingsByAnimation,
  CliFitMarginUnit,
  CliFitMode,
  CliFitOptions,
  CliFitScope,
  CliWorkflowCameraTarget,
  CliWorkflowDirectionOverride,
  CliWorkflowDirectionOverrides,
} from "./types.js";

const DEFAULTS = {
  format: "spritesheet",
  frames: 8,
  fps: 10,
  width: 64,
  height: 64,
  output: "./out",
  port: 4174,
  cameraDistance: 5,
  normalMap: false,
  atlasLayout: "rows",
  atlasPadding: 0,
  atlasBleed: 0,
  atlasSpriteMargin: 0,
  fit: "manual",
  margin: 0,
  marginUnit: "px",
  fitScope: "all",
  fitSamples: 12,
  atlasScale: 1,
  maxAtlasSize: 2048,
  multiPage: false,
  exportTimeout: 60000,
} as const;

const FORMAT_ALIASES: Record<string, ExportFormat> = {
  "bevy-rust": "bevy",
  love2d: "love2d-lua",
  anim8: "love2d-anim8",
};

type RawJobOptions = {
  id?: unknown;
  input?: unknown;
  format?: unknown;
  frames?: unknown;
  fps?: unknown;
  width?: unknown;
  height?: unknown;
  output?: unknown;
  port?: unknown;
  workflow?: unknown;
  cameraDistance?: unknown;
  cameraAngle?: unknown;
  phi?: unknown;
  directionRotationOffset?: unknown;
  target?: unknown;
  directionOverride?: unknown;
  directionOverrides?: unknown;
  skipStepLabel?: unknown;
  skipStepLabels?: unknown;
  clip?: unknown;
  clips?: unknown;
  sheet?: unknown;
  captureSettings?: unknown;
  isolateModels?: unknown;
  forceAnimationsInPlace?: unknown;
  captureNormalMaps?: unknown;
  normalMap?: unknown;
  atlasLayout?: unknown;
  atlasPadding?: unknown;
  atlasBleed?: unknown;
  atlasSpriteMargin?: unknown;
  fit?: unknown;
  margin?: unknown;
  marginUnit?: unknown;
  fitScope?: unknown;
  fitSamples?: unknown;
  atlasScale?: unknown;
  maxAtlasSize?: unknown;
  multiPage?: unknown;
  atlasOptions?: unknown;
  timeout?: unknown;
  exportTimeout?: unknown;
  workflowTimeout?: unknown;
  debug?: unknown;
  quiet?: unknown;
  json?: unknown;
  headful?: unknown;
  keepServer?: unknown;
};

type CliConfigFile = {
  defaults?: RawJobOptions;
  jobs?: RawJobOptions[];
};

export type CliJob = {
  id: string;
  input: string;
  format: ExportFormat;
  frames: number;
  /** Take each sequence's frame count from its clip instead of `frames`. */
  matchClipLength: boolean;
  fps: number;
  width: number;
  height: number;
  output: string;
  port: number;
  workflow?: string;
  cameraDistance: number;
  cameraAngle?: number;
  directionRotationOffset?: number;
  target?: CliWorkflowCameraTarget;
  directionOverrides?: CliWorkflowDirectionOverrides;
  skipStepLabels?: string[];
  /** Capture only these clips, by name. */
  includeAnimations?: string[];
  /** Sheet for every sequence, or a clip-name → sheet map. */
  sheets?: { all?: string; byAnimation?: Record<string, string> };
  /** Per-clip frame count and rate, from a config job. */
  captureSettings?: CliCaptureSettingsByAnimation;
  /** Hide the other models while each sequence records. */
  isolateModels?: boolean;
  forceAnimationsInPlace?: boolean;
  captureNormalMaps?: boolean;
  fit: CliFitOptions;
  normalMap: boolean;
  atlasOptions: CliAtlasOptions;
  timeout?: number;
  exportTimeout: number;
  workflowTimeout?: number;
};

export type CliRunCommand = {
  kind: "run";
  jobs: CliJob[];
  dryRun: boolean;
  quiet: boolean;
  json: boolean;
  debug: boolean;
  headful: boolean;
  keepServer: boolean;
  writeSummary?: string;
  failOnWarnings: boolean;
};

export type CliInfoCommand =
  | { kind: "help"; text: string; json: boolean }
  | { kind: "version"; version: string; json: boolean }
  | { kind: "list-formats"; formats: string[]; aliases: Record<string, string>; json: boolean }
  | {
      kind: "list-workflows";
      workflows: { id: string; label: string }[];
      json: boolean;
    };

export type CliCommand = CliRunCommand | CliInfoCommand;

export type ParseCliOptions = {
  cwd?: string;
  version?: string;
  validateInput?: boolean;
};

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export async function parseCliCommand(
  argv = process.argv.slice(2),
  options: ParseCliOptions = {},
): Promise<CliCommand> {
  const cwd = options.cwd ?? process.cwd();
  const version = options.version ?? "0.4.0";
  const parsed = parseArgs({
    args: argv,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
      "list-formats": { type: "boolean" },
      "list-workflows": { type: "boolean" },
      dryRun: { type: "boolean" },
      quiet: { type: "boolean" },
      json: { type: "boolean" },
      debug: { type: "boolean" },
      headful: { type: "boolean" },
      keepServer: { type: "boolean" },
      writeSummary: { type: "string" },
      failOnWarnings: { type: "boolean" },
      config: { type: "string" },
      job: { type: "string" },
      format: { type: "string" },
      frames: { type: "string" },
      fps: { type: "string" },
      width: { type: "string" },
      height: { type: "string" },
      output: { type: "string" },
      port: { type: "string" },
      workflow: { type: "string" },
      cameraDistance: { type: "string" },
      cameraAngle: { type: "string" },
      phi: { type: "string" },
      directionRotationOffset: { type: "string" },
      target: { type: "string" },
      directionOverride: { type: "string", multiple: true },
      skipStepLabel: { type: "string", multiple: true },
      skipStepLabels: { type: "string" },
      clip: { type: "string", multiple: true },
      clips: { type: "string" },
      sheet: { type: "string", multiple: true },
      forceAnimationsInPlace: { type: "string" },
      captureNormalMaps: { type: "string" },
      isolateModels: { type: "string" },
      normalMap: { type: "string" },
      atlasLayout: { type: "string" },
      atlasPadding: { type: "string" },
      atlasBleed: { type: "string" },
      atlasSpriteMargin: { type: "string" },
      fit: { type: "string" },
      margin: { type: "string" },
      marginUnit: { type: "string" },
      fitScope: { type: "string" },
      fitSamples: { type: "string" },
      atlasScale: { type: "string" },
      maxAtlasSize: { type: "string" },
      multiPage: { type: "string" },
      timeout: { type: "string" },
      exportTimeout: { type: "string" },
      workflowTimeout: { type: "string" },
    },
    allowPositionals: true,
  });

  const values = parsed.values as Record<string, unknown>;
  const json = Boolean(values.json);

  if (values.help) {
    return { kind: "help", text: createHelpText(), json };
  }

  if (values.version) {
    return { kind: "version", version, json };
  }

  if (values["list-formats"]) {
    return {
      kind: "list-formats",
      formats: [...EXPORT_FORMATS],
      aliases: FORMAT_ALIASES,
      json,
    };
  }

  if (values["list-workflows"]) {
    return {
      kind: "list-workflows",
      workflows: WORKFLOW_PRESETS.map(({ id, label }) => ({ id, label })),
      json,
    };
  }

  const cliOptions = rawValuesToJobOptions(values);
  const cliGlobal = {
    dryRun: Boolean(values.dryRun),
    quiet: Boolean(values.quiet),
    json,
    debug: Boolean(values.debug),
    headful: Boolean(values.headful),
    keepServer: Boolean(values.keepServer),
    writeSummary:
      values.writeSummary === undefined
        ? undefined
        : resolveMaybeRelative(cwd, getString(values.writeSummary, "writeSummary")),
    failOnWarnings: Boolean(values.failOnWarnings),
  };
  const input = parsed.positionals[0];
  const configPath = getOptionalString(values.config, "config");
  const jobFilter = getOptionalString(values.job, "job");

  if (jobFilter && !configPath) {
    throw new CliUsageError("--job requires --config.");
  }

  let config: CliConfigFile | undefined;
  let configDir = cwd;
  if (configPath) {
    const resolvedConfig = resolve(cwd, configPath);
    configDir = dirname(resolvedConfig);
    config = await readConfigFile(resolvedConfig);
  }

  const configDefaults = resolveConfigPathFields(config?.defaults, configDir);
  const configJobs = (config?.jobs ?? []).map((job) =>
    resolveConfigPathFields(job, configDir),
  );

  let rawJobs: RawJobOptions[];
  if (configJobs.length > 0 && !input) {
    rawJobs = configJobs;
  } else {
    rawJobs = [{ input }];
  }

  if (jobFilter) {
    rawJobs = rawJobs.filter((job) => getOptionalString(job.id, "id") === jobFilter);
    if (rawJobs.length === 0) {
      throw new CliUsageError(`No config job found with id "${jobFilter}".`);
    }
  }

  const jobs = rawJobs.map((job, index) =>
    normalizeJob(
      {
        ...configDefaults,
        ...job,
        ...cliOptions,
        input: input ?? cliOptions.input ?? job.input ?? configDefaults?.input,
      },
      cwd,
      index,
    ),
  );

  if (jobs.length === 0) {
    throw new CliUsageError(
      `Usage: sprite-sheet-helper <input> [options]\nAccepted model formats: ${ACCEPTED_MODEL_FILE_TYPES.join(", ")}`,
    );
  }

  if (options.validateInput !== false && !cliGlobal.dryRun) {
    await Promise.all(jobs.map((job) => access(job.input)));
  }

  return {
    kind: "run",
    jobs,
    ...cliGlobal,
  };
}

export function createHelpText(): string {
  return [
    "Usage: sprite-sheet-helper <input> [options]",
    "",
    "Commands:",
    "  --help                 Show this help.",
    "  --version              Print the CLI version.",
    "  --list-formats         List supported export formats.",
    "  --list-workflows       List workflow preset ids.",
    "",
    "Core options:",
    "  --format <id>          Export format. Default: spritesheet",
    "  --frames <n|auto>      Frames per sequence, or `auto` to match each clip. Default: 8",
    "  --fps <n>              Capture frame rate. Default: 10",
    "  --width <px>           Frame width. Default: 64",
    "  --height <px>          Frame height. Default: 64",
    "  --output <dir>         Output directory. Default: ./out",
    "  --workflow <id>        Auto-capture workflow preset.",
    "  --normalMap <bool>     Capture and export normal maps.",
    "",
    "Workflow camera options:",
    "  --cameraDistance <n>           Camera distance. Default: 5",
    "  --cameraAngle <deg>            Camera elevation angle. Alias: --phi",
    "  --directionRotationOffset <deg> Rotate all workflow directions.",
    "  --target <x,y,z>               Camera target point.",
    "  --directionOverride <spec>     e.g. N:phi=45,theta=0,distance=3,target=0,0.8,0",
    "  --clip <name>                  Capture only this clip. Can repeat this flag.",
    "  --clips <names>                Comma-separated clip names to capture.",
    "  --sheet <name|clip=name>       Sheet for every sequence, or for one clip. Can repeat.",
    "  --skipStepLabel <label>        Skip a single workflow step label. Can repeat this flag.",
    "  --skipStepLabels <labels>      Comma-separated workflow step labels to skip.",
    "  --captureNormalMaps <bool>     Capture workflow outputs with normal maps.",
    "  --forceAnimationsInPlace <bool> Force workflow clips to remain in place.",
    "  --isolateModels <bool>         Hide other models while each sequence records.",
    "",
    "Atlas options:",
    "  --atlasLayout <rows|packed>  Default: rows",
    "  --atlasPadding <px>         Default: 0",
    "  --atlasBleed <px>           Edge extrusion. Default: 0",
    "  --atlasSpriteMargin <px>    Transparent border inside each frame rect. Default: 0",
    "",
    "Framing options:",
    "  --fit <auto|manual>         Solve one framing for the whole run. Default: manual",
    "  --margin <n>                Margin reserved around the sprite. Default: 0",
    "  --marginUnit <px|percent>   Unit for --margin. Default: px",
    "  --fitScope <all|animation|direction>  What shares a framing. Default: all",
    "  --fitSamples <n>            Poses sampled per clip while measuring. Default: 12",
    "  --atlasScale <n>            Default: 1",
    "  --maxAtlasSize <px>         Default: 2048",
    "  --multiPage <bool>          Allow generic spritesheet page splitting.",
    "",
    "Automation options:",
    "  --config <path>        Run jobs from a JSON config.",
    "  --job <id>             Run one config job.",
    "  --dryRun               Print resolved jobs without launching the browser.",
    "  --json                 Print machine-readable output.",
    "  --quiet                Suppress progress logs.",
    "  --debug                Show browser console output.",
    "  --headful              Launch Chromium with a visible window.",
    "  --keepServer           Leave the Vite preview server running.",
    "  --writeSummary <path>  Write the machine-readable run summary to a file.",
    "  --failOnWarnings       Exit with an error if the run reports warnings.",
    "  --timeout <ms>         Per-job timeout.",
    "  --exportTimeout <ms>   Export download timeout. Default: 60000",
    "  --workflowTimeout <ms> Workflow completion timeout.",
    "",
    `Formats: ${EXPORT_FORMATS.join(", ")}`,
    `Workflow ids: ${WORKFLOW_PRESETS.map((workflow) => workflow.id).join(", ")}`,
  ].join("\n");
}

function rawValuesToJobOptions(values: Record<string, unknown>): RawJobOptions {
  const raw: RawJobOptions = {};
  const keys: (keyof RawJobOptions)[] = [
    "format",
    "frames",
    "fps",
    "width",
    "height",
    "output",
    "port",
    "workflow",
    "cameraDistance",
    "cameraAngle",
    "phi",
    "directionRotationOffset",
    "target",
    "directionOverride",
    "skipStepLabel",
    "skipStepLabels",
    "clip",
    "clips",
    "sheet",
    "forceAnimationsInPlace",
    "captureNormalMaps",
    "isolateModels",
    "normalMap",
    "atlasLayout",
    "atlasPadding",
    "atlasBleed",
    "atlasSpriteMargin",
    "fit",
    "margin",
    "marginUnit",
    "fitScope",
    "fitSamples",
    "atlasScale",
    "maxAtlasSize",
    "multiPage",
    "timeout",
    "exportTimeout",
    "workflowTimeout",
  ];

  for (const key of keys) {
    if (values[key] !== undefined) {
      raw[key] = values[key];
    }
  }

  return raw;
}

async function readConfigFile(path: string): Promise<CliConfigFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new CliUsageError(
      `Unable to read CLI config "${path}": ${(error as Error).message}`,
    );
  }

  if (!isRecord(parsed)) {
    throw new CliUsageError("CLI config must be a JSON object.");
  }

  if (parsed.jobs !== undefined && !Array.isArray(parsed.jobs)) {
    throw new CliUsageError("CLI config jobs must be an array.");
  }

  return {
    defaults: isRecord(parsed.defaults) ? parsed.defaults : undefined,
    jobs: Array.isArray(parsed.jobs)
      ? parsed.jobs.map((job, index) => {
          if (!isRecord(job)) {
            throw new CliUsageError(`Config job ${index + 1} must be an object.`);
          }
          return job;
        })
      : undefined,
  };
}

function resolveConfigPathFields(
  options: RawJobOptions | undefined,
  baseDir: string,
): RawJobOptions {
  if (!options) return {};
  return {
    ...options,
    input:
      typeof options.input === "string"
        ? resolveMaybeRelative(baseDir, options.input)
        : options.input,
    output:
      typeof options.output === "string"
        ? resolveMaybeRelative(baseDir, options.output)
        : options.output,
  };
}

function normalizeJob(raw: RawJobOptions, cwd: string, index: number): CliJob {
  const input = getOptionalString(raw.input, "input");
  if (!input) {
    throw new CliUsageError("Missing input model path.");
  }

  const resolvedInput = resolveMaybeRelative(cwd, input);
  const ext = extname(resolvedInput).replace(".", "").toLowerCase();
  if (!(ACCEPTED_MODEL_FILE_TYPES as readonly string[]).includes(ext)) {
    throw new CliUsageError(
      `Unsupported model format ".${ext}". Accepted: ${ACCEPTED_MODEL_FILE_TYPES.join(", ")}`,
    );
  }

  const format = parseFormat(raw.format ?? DEFAULTS.format);
  const workflow = getOptionalString(raw.workflow, "workflow");
  if (workflow && !WORKFLOW_PRESETS.some((preset) => preset.id === workflow)) {
    throw new CliUsageError(
      `Unknown workflow "${workflow}". Valid: ${WORKFLOW_PRESETS.map((preset) => preset.id).join(", ")}`,
    );
  }

  const atlasOptions = normalizeAtlasOptions(raw);
  const cameraAngleSource = raw.cameraAngle ?? raw.phi;

  return {
    id: getOptionalString(raw.id, "id") ?? `job-${index + 1}`,
    input: resolvedInput,
    format,
    // `--frames auto` takes each sequence's length from its own clip, which is
    // the only count that neither repeats poses nor truncates the motion.
    frames:
      normalizeFramesValue(raw.frames) === "auto"
        ? DEFAULTS.frames
        : positiveInteger(raw.frames ?? DEFAULTS.frames, "frames"),
    matchClipLength: normalizeFramesValue(raw.frames) === "auto",
    fps: positiveNumber(raw.fps ?? DEFAULTS.fps, "fps"),
    width: positiveInteger(raw.width ?? DEFAULTS.width, "width"),
    height: positiveInteger(raw.height ?? DEFAULTS.height, "height"),
    output: resolveMaybeRelative(
      cwd,
      getOptionalString(raw.output, "output") ?? DEFAULTS.output,
    ),
    port: positiveInteger(raw.port ?? DEFAULTS.port, "port"),
    workflow,
    cameraDistance: positiveNumber(
      raw.cameraDistance ?? DEFAULTS.cameraDistance,
      "cameraDistance",
    ),
    cameraAngle:
      cameraAngleSource === undefined
        ? undefined
        : finiteNumber(cameraAngleSource, "cameraAngle"),
    directionRotationOffset:
      raw.directionRotationOffset === undefined
        ? undefined
        : finiteNumber(raw.directionRotationOffset, "directionRotationOffset"),
    target:
      raw.target === undefined
        ? undefined
        : parseTarget(raw.target, "target"),
    fit: parseFitOptions(raw),
    directionOverrides: parseDirectionOverrides(raw),
    skipStepLabels: parseSkipStepLabels(raw),
    includeAnimations: parseClipNames(raw),
    sheets: parseSheetAssignments(raw),
    captureSettings: parseCaptureSettings(raw),
    isolateModels:
      raw.isolateModels === undefined
        ? undefined
        : parseBoolean(raw.isolateModels, "isolateModels"),
    forceAnimationsInPlace: parseForceAnimationsInPlace(raw),
    captureNormalMaps: parseCaptureNormalMaps(raw),
    normalMap: parseBoolean(raw.normalMap ?? DEFAULTS.normalMap, "normalMap"),
    atlasOptions,
    timeout:
      raw.timeout === undefined
        ? undefined
        : positiveInteger(raw.timeout, "timeout"),
    exportTimeout: positiveInteger(
      raw.exportTimeout ?? DEFAULTS.exportTimeout,
      "exportTimeout",
    ),
    workflowTimeout:
      raw.workflowTimeout === undefined
        ? undefined
        : positiveInteger(raw.workflowTimeout, "workflowTimeout"),
  };
}

function normalizeAtlasOptions(raw: RawJobOptions): CliAtlasOptions {
  const nested = isRecord(raw.atlasOptions) ? raw.atlasOptions : {};
  const layout = raw.atlasLayout ?? nested.layout ?? DEFAULTS.atlasLayout;
  const layoutValue = getString(layout, "atlasLayout");
  if (layoutValue !== "rows" && layoutValue !== "packed") {
    throw new CliUsageError('atlasLayout must be "rows" or "packed".');
  }

  return {
    layout: layoutValue,
    padding: nonNegativeInteger(
      raw.atlasPadding ?? nested.padding ?? DEFAULTS.atlasPadding,
      "atlasPadding",
    ),
    extrude: nonNegativeInteger(
      raw.atlasBleed ?? nested.extrude ?? DEFAULTS.atlasBleed,
      "atlasBleed",
    ),
    spriteMargin: nonNegativeInteger(
      raw.atlasSpriteMargin ??
        nested.spriteMargin ??
        DEFAULTS.atlasSpriteMargin,
      "atlasSpriteMargin",
    ),
    scale: positiveNumber(
      raw.atlasScale ?? nested.scale ?? DEFAULTS.atlasScale,
      "atlasScale",
    ),
    maxAtlasSize: positiveInteger(
      raw.maxAtlasSize ?? nested.maxAtlasSize ?? DEFAULTS.maxAtlasSize,
      "maxAtlasSize",
    ),
    allowMultiPage: parseBoolean(
      raw.multiPage ?? nested.allowMultiPage ?? DEFAULTS.multiPage,
      "multiPage",
    ),
  };
}

function parseFormat(value: unknown): ExportFormat {
  const raw = getString(value, "format");
  const aliased = FORMAT_ALIASES[raw] ?? raw;
  if (!(EXPORT_FORMATS as readonly string[]).includes(aliased)) {
    throw new CliUsageError(
      `Unknown format "${raw}". Valid: ${EXPORT_FORMATS.join(", ")}`,
    );
  }
  return aliased as ExportFormat;
}

const FIT_MODES: CliFitMode[] = ["auto", "manual"];
const FIT_SCOPES: CliFitScope[] = ["all", "animation", "direction"];
const FIT_MARGIN_UNITS: CliFitMarginUnit[] = ["px", "percent"];

function parseFitOptions(raw: RawJobOptions): CliFitOptions {
  const mode = (getOptionalString(raw.fit, "fit") ??
    DEFAULTS.fit) as CliFitMode;
  if (!FIT_MODES.includes(mode)) {
    throw new CliUsageError('fit must be "auto" or "manual".');
  }

  const scope = (getOptionalString(raw.fitScope, "fitScope") ??
    DEFAULTS.fitScope) as CliFitScope;
  if (!FIT_SCOPES.includes(scope)) {
    throw new CliUsageError(
      'fitScope must be "all", "animation" or "direction".',
    );
  }

  const marginUnit = (getOptionalString(raw.marginUnit, "marginUnit") ??
    DEFAULTS.marginUnit) as CliFitMarginUnit;
  if (!FIT_MARGIN_UNITS.includes(marginUnit)) {
    throw new CliUsageError('marginUnit must be "px" or "percent".');
  }

  const margin =
    raw.margin === undefined
      ? DEFAULTS.margin
      : finiteNumber(raw.margin, "margin");
  if (margin < 0) {
    throw new CliUsageError("margin must be zero or greater.");
  }

  return {
    mode,
    margin,
    marginUnit,
    scope,
    samples: positiveInteger(raw.fitSamples ?? DEFAULTS.fitSamples, "fitSamples"),
  };
}

function parseDirectionOverrides(
  raw: RawJobOptions,
): CliWorkflowDirectionOverrides | undefined {
  const overrides: CliWorkflowDirectionOverrides = {};

  if (isRecord(raw.directionOverrides)) {
    for (const [label, value] of Object.entries(raw.directionOverrides)) {
      if (!isRecord(value)) {
        throw new CliUsageError(`directionOverrides.${label} must be an object.`);
      }
      overrides[label] = parseDirectionOverrideObject(value, label);
    }
  }

  const cliOverrides = raw.directionOverride;
  const entries = Array.isArray(cliOverrides)
    ? cliOverrides
    : cliOverrides === undefined
      ? []
      : [cliOverrides];

  for (const entry of entries) {
    const [label, override] = parseDirectionOverrideString(
      getString(entry, "directionOverride"),
    );
    overrides[label] = { ...overrides[label], ...override };
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function collectStrings(value: unknown, name: string): string[] {
  const values = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];

  return values.flatMap((entry) => {
    if (typeof entry !== "string") {
      throw new CliUsageError(`${name} must be a string.`);
    }
    return entry
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  });
}

/**
 * Clips to capture, by their own names.
 *
 * `--skipStepLabel` works the other way round and needs the generated label of
 * every step you do *not* want (`walk_NE`, `walk_SE`, …), which means knowing
 * the preset's directions before you can leave a clip out.
 */
function parseClipNames(raw: RawJobOptions): string[] | undefined {
  const names = [
    ...collectStrings(raw.clip, "clip"),
    ...collectStrings(raw.clips, "clips"),
  ];

  return names.length > 0 ? [...new Set(names)] : undefined;
}

/**
 * `--sheet hero` puts everything on one sheet; `--sheet walk=hero` puts one
 * clip's sequences there. Both forms can be repeated.
 */
function parseSheetAssignments(
  raw: RawJobOptions,
): { all?: string; byAnimation?: Record<string, string> } | undefined {
  const entries = collectStrings(raw.sheet, "sheet");
  if (entries.length === 0) return undefined;

  let all: string | undefined;
  const byAnimation: Record<string, string> = {};

  for (const entry of entries) {
    const separator = entry.indexOf("=");
    if (separator === -1) {
      all = entry;
      continue;
    }

    const animation = entry.slice(0, separator).trim();
    const sheet = entry.slice(separator + 1).trim();
    if (!animation || !sheet) {
      throw new CliUsageError(
        `sheet assignments look like "clip=sheet" (got "${entry}").`,
      );
    }
    byAnimation[animation] = sheet;
  }

  return {
    ...(all === undefined ? {} : { all }),
    ...(Object.keys(byAnimation).length > 0 ? { byAnimation } : {}),
  };
}

/**
 * Per-clip capture settings from a config job:
 *
 *   "captureSettings": { "walk": { "fps": 24 }, "idle": { "frames": 6 } }
 *
 * The CLI's global `--frames` and `--fps` apply to every clip in a run, which
 * is rarely what a mixed set of animations wants.
 */
function parseCaptureSettings(
  raw: RawJobOptions,
): CliCaptureSettingsByAnimation | undefined {
  if (raw.captureSettings === undefined) return undefined;
  if (
    typeof raw.captureSettings !== "object" ||
    raw.captureSettings === null ||
    Array.isArray(raw.captureSettings)
  ) {
    throw new CliUsageError("captureSettings must be an object of clip names.");
  }

  const parsed: CliCaptureSettingsByAnimation = {};

  for (const [animation, value] of Object.entries(
    raw.captureSettings as Record<string, unknown>,
  )) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new CliUsageError(
        `captureSettings.${animation} must be an object.`,
      );
    }

    const entry = value as {
      frames?: unknown;
      fps?: unknown;
      matchClipLength?: unknown;
    };
    const settings: CliCaptureSettings = {};

    if (entry.frames !== undefined) {
      settings.frameCount = positiveInteger(
        entry.frames,
        `captureSettings.${animation}.frames`,
      );
    }
    if (entry.fps !== undefined) {
      settings.frameIntervalMs = Math.max(
        1,
        Math.round(
          1000 /
            positiveNumber(entry.fps, `captureSettings.${animation}.fps`),
        ),
      );
    }
    if (entry.matchClipLength !== undefined) {
      settings.matchClipLength = parseBoolean(
        entry.matchClipLength,
        `captureSettings.${animation}.matchClipLength`,
      );
    }

    parsed[animation] = settings;
  }

  return parsed;
}

function parseSkipStepLabels(raw: RawJobOptions): string[] | undefined {
  const all = [
    ...(Array.isArray(raw.skipStepLabel)
      ? raw.skipStepLabel
      : raw.skipStepLabel === undefined
        ? []
        : [raw.skipStepLabel]),
    ...(Array.isArray(raw.skipStepLabels)
      ? raw.skipStepLabels
      : raw.skipStepLabels === undefined
        ? []
        : [raw.skipStepLabels]),
  ];

  if (all.length === 0) return undefined;

  const parsed = all.flatMap((value, index) => {
    if (typeof value !== "string") {
      throw new CliUsageError(
        `skipStepLabel and skipStepLabels must be strings (error at index ${index}).`,
      );
    }
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  });

  return parsed.length > 0 ? Array.from(new Set(parsed)) : undefined;
}

function parseForceAnimationsInPlace(raw: RawJobOptions): boolean | undefined {
  if (raw.forceAnimationsInPlace === undefined) return undefined;
  return parseBoolean(raw.forceAnimationsInPlace, "forceAnimationsInPlace");
}

function parseCaptureNormalMaps(raw: RawJobOptions): boolean | undefined {
  if (raw.captureNormalMaps === undefined) return undefined;
  return parseBoolean(raw.captureNormalMaps, "captureNormalMaps");
}

function parseDirectionOverrideObject(
  value: Record<string, unknown>,
  label: string,
): CliWorkflowDirectionOverride {
  return {
    ...(value.phi === undefined
      ? {}
      : { phi: finiteNumber(value.phi, `directionOverrides.${label}.phi`) }),
    ...(value.theta === undefined
      ? {}
      : { theta: finiteNumber(value.theta, `directionOverrides.${label}.theta`) }),
    ...(value.distance === undefined
      ? {}
      : {
          distance: positiveNumber(
            value.distance,
            `directionOverrides.${label}.distance`,
          ),
        }),
    ...(value.target === undefined
      ? {}
      : {
          target: parseTarget(
            value.target,
            `directionOverrides.${label}.target`,
          ),
        }),
  };
}

function parseDirectionOverrideString(
  value: string,
): [string, CliWorkflowDirectionOverride] {
  const separator = value.indexOf(":");
  if (separator <= 0) {
    throw new CliUsageError(
      'directionOverride must look like "N:phi=45,theta=0,distance=3,target=0,0.8,0".',
    );
  }

  const label = value.slice(0, separator).trim();
  const rest = value.slice(separator + 1);
  const parts = rest.split(",");
  const parsed: Record<string, string | string[]> = {};

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const eq = part.indexOf("=");
    if (eq <= 0) {
      throw new CliUsageError(`Invalid directionOverride segment "${part}".`);
    }

    const key = part.slice(0, eq).trim();
    const rawValue = part.slice(eq + 1).trim();
    if (key === "target") {
      const targetParts = [rawValue, parts[index + 1], parts[index + 2]];
      if (targetParts.some((entry) => entry === undefined)) {
        throw new CliUsageError("directionOverride target must have three values.");
      }
      parsed.target = targetParts.map((entry) => String(entry).trim());
      index += 2;
    } else {
      parsed[key] = rawValue;
    }
  }

  return [label, parseDirectionOverrideObject(parsed, label)];
}

function parseTarget(value: unknown, name: string): CliWorkflowCameraTarget {
  const entries = Array.isArray(value) ? value : getString(value, name).split(",");
  if (entries.length !== 3) {
    throw new CliUsageError(`${name} must contain exactly three numbers.`);
  }
  return entries.map((entry, index) =>
    finiteNumber(entry, `${name}[${index}]`),
  ) as CliWorkflowCameraTarget;
}

function parseBoolean(value: unknown, name: string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") {
    throw new CliUsageError(`${name} must be a boolean.`);
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  throw new CliUsageError(`${name} must be true or false.`);
}

/** `--frames auto` versus `--frames <n>`. */
function normalizeFramesValue(value: unknown): "auto" | "count" {
  return typeof value === "string" && value.trim().toLowerCase() === "auto"
    ? "auto"
    : "count";
}

function positiveInteger(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (!Number.isInteger(number) || number <= 0) {
    throw new CliUsageError(`${name} must be a positive integer.`);
  }
  return number;
}

function nonNegativeInteger(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (!Number.isInteger(number) || number < 0) {
    throw new CliUsageError(`${name} must be a non-negative integer.`);
  }
  return number;
}

function positiveNumber(value: unknown, name: string): number {
  const number = finiteNumber(value, name);
  if (number <= 0) {
    throw new CliUsageError(`${name} must be greater than 0.`);
  }
  return number;
}

function finiteNumber(value: unknown, name: string): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(raw)) {
    throw new CliUsageError(`${name} must be a finite number.`);
  }
  return raw;
}

function getString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CliUsageError(`${name} must be a non-empty string.`);
  }
  return value;
}

function getOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  return getString(value, name);
}

function resolveMaybeRelative(baseDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(baseDir, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
