import type { AtlasOptions, ExportFormat, ExportRow } from "@/types/file";
import {
  ATLAS_EXPORT_FORMATS,
  MULTI_PAGE_ATLAS_FORMATS,
  createAtlasPlan,
  getAtlasFrameSlotSize,
  normalizeAtlasOptions,
  type AtlasPlan,
} from "./atlas";
import {
  getNormalCoverage,
  getRepeatedFrameCount,
} from "./exports/helpers";
import { groupRowsBySheet } from "./exports/sheets";

const NORMAL_MAP_EXPORT_FORMATS = new Set<ExportFormat>([
  "spritesheet",
  "love2d-lua",
  "love2d-anim8",
  "turbo",
  "bevy",
  "phaser",
  "godot",
  "pygame",
  "raylib",
  "unity",
]);

export type ExportValidationSeverity = "error" | "warning" | "info";

/**
 * The export rail is presented as a pipeline, so every message names the step
 * that owns it. A message with no stage is reported against the whole export.
 */
export type ExportStage = "scene" | "capture" | "effects" | "pack" | "export";

export type ExportValidationMessage = {
  severity: ExportValidationSeverity;
  /**
   * The headline. Printed identically on every surface that reports this
   * problem — a rail and a dialog that paraphrase each other make the reader
   * wonder whether they are looking at two different problems.
   */
  message: string;
  /** Longer form, for surfaces with room for it. Never a reworded headline. */
  detail?: string;
  /** The one-click remedy, where one exists. */
  fix?: string;
  stage?: ExportStage;
};

/**
 * One sheet's packing result: the sequences assigned to it, and the atlas they
 * pack into. An export writes one of these per sheet.
 */
export type ExportSheet = {
  /** The name as typed on the sequences. */
  name: string;
  /** The file stem the export writes this sheet under. */
  base: string;
  rows: ExportRow[];
  plan: AtlasPlan | null;
  frameCount: number;
  animationCount: number;
  pageCount: number;
  imageWidth: number;
  imageHeight: number;
};

export type ExportValidationResult = {
  messages: ExportValidationMessage[];
  blocking: boolean;
  /**
   * The first sheet's plan — what a single-sheet export has always returned,
   * and what surfaces showing one atlas read. Use `sheets` to reach the rest.
   */
  plan: AtlasPlan | null;
  sheets: ExportSheet[];
};

export type ExportSummary = {
  animationCount: number;
  frameCount: number;
  /** Totals for the first sheet, which is the whole export until one is split. */
  pageCount: number;
  imageWidth: number;
  imageHeight: number;
  normalStatus: ReturnType<typeof getNormalCoverage>["status"];
  sheets: ExportSheet[];
};

/**
 * Group rows into sheets and pack each one.
 *
 * Sheets are packed apart, never into a shared atlas: that is the whole point
 * of assigning one — a sheet is the unit an engine loads as a single texture.
 */
function planSheets(
  rows: ExportRow[],
  options: AtlasOptions,
  packed: boolean,
): ExportSheet[] {
  return groupRowsBySheet(rows).map((sheet) => {
    const frameCount = sheet.rows.reduce(
      (acc, row) => acc + row.images.length,
      0,
    );
    const plan =
      packed && frameCount > 0 ? createAtlasPlan(sheet.rows, options) : null;

    return {
      ...sheet,
      plan,
      frameCount,
      animationCount: sheet.rows.length,
      pageCount: plan?.pages.length ?? 0,
      imageWidth: plan?.pages[0]?.width ?? 0,
      imageHeight: plan?.pages[0]?.height ?? 0,
    };
  });
}

export function getExportSummary(
  rows: ExportRow[],
  options: Partial<AtlasOptions> = {},
): ExportSummary {
  const frameCount = rows.reduce((acc, row) => acc + row.images.length, 0);
  const sheets = planSheets(rows, normalizeAtlasOptions(options), true);
  const normalCoverage = getNormalCoverage(rows);
  const first = sheets[0];

  return {
    animationCount: rows.length,
    frameCount,
    pageCount: first?.pageCount ?? 0,
    imageWidth: first?.imageWidth ?? 0,
    imageHeight: first?.imageHeight ?? 0,
    normalStatus: normalCoverage.status,
    sheets,
  };
}

export function validateExportRequest({
  rows,
  format,
  includeNormalMap,
  atlasOptions,
}: {
  rows: ExportRow[];
  format: ExportFormat;
  includeNormalMap: boolean;
  atlasOptions?: Partial<AtlasOptions>;
}): ExportValidationResult {
  const options = normalizeAtlasOptions(atlasOptions);
  const messages: ExportValidationMessage[] = [];
  const frameCount = rows.reduce((acc, row) => acc + row.images.length, 0);

  if (rows.length === 0 || frameCount === 0) {
    messages.push({
      severity: "error",
      message: "Capture or add at least one frame before exporting.",
      stage: "capture",
    });
    return { messages, blocking: true, plan: null, sheets: [] };
  }

  for (const row of rows) {
    if (row.frameWidth <= 0 || row.frameHeight <= 0) {
      messages.push({
        severity: "error",
        message: `Sequence "${row.label}" has an invalid frame size.`,
        stage: "capture",
      });
      continue;
    }

    const slot = getAtlasFrameSlotSize(row, options);
    if (slot.slotW > options.maxAtlasSize || slot.slotH > options.maxAtlasSize) {
      messages.push({
        severity: "error",
        message: `Sequence "${row.label}" frames are ${slot.slotW}x${slot.slotH}px including padding/extrusion and cannot fit within the ${options.maxAtlasSize}px max atlas size.`,
        stage: "pack",
      });
    }
  }

  for (const row of rows) {
    const repeated = getRepeatedFrameCount(row);
    if (repeated === 0) continue;

    messages.push({
      severity: "warning",
      message: `Sequence "${row.label}" repeats ${repeated} frame${repeated === 1 ? "" : "s"}.`,
      detail:
        "Frames identical to the one before them cost atlas space and add nothing to the animation. This usually means the capture ran longer than the clip — match the frame count to the clip length, or shorten the capture.",
      stage: "capture",
    });
  }

  if (options.padding > 0 && options.extrude === 0) {
    messages.push({
      severity: "warning",
      message: "Padding without extrusion leaves transparent gaps around frames.",
      detail:
        "Add extrusion if the atlas will be sampled with filtering, or the gaps show as seams between frames.",
      stage: "pack",
    });
  }

  if (options.extrude > 0 && options.padding === 0) {
    messages.push({
      severity: "info",
      message: "Extrusion duplicates edge pixels around each frame.",
      detail:
        "Add padding too if your engine needs additional empty spacing between slots.",
      stage: "pack",
    });
  }

  if (![1, 2, 4].includes(options.scale)) {
    messages.push({
      severity: "info",
      message: "Custom atlas scale is enabled.",
      detail: "Frame dimensions are rounded to whole pixels.",
      stage: "pack",
    });
  }

  const sheets = planSheets(rows, options, ATLAS_EXPORT_FORMATS.has(format));
  const plan = sheets[0]?.plan ?? null;

  if (includeNormalMap && !NORMAL_MAP_EXPORT_FORMATS.has(format)) {
    messages.push({
      severity: "warning",
      message: `${format} does not emit a normal-map atlas.`,
      stage: "export",
    });
  }

  if (includeNormalMap && NORMAL_MAP_EXPORT_FORMATS.has(format)) {
    const coverage = getNormalCoverage(rows);
    if (coverage.totalFrames > 0 && coverage.normalFrames === 0) {
      messages.push({
        severity: "warning",
        message: "No frames have captured normals.",
        detail: "The normal atlas will use transparent placeholders.",
        stage: "capture",
      });
    } else if (coverage.missingFrames > 0) {
      messages.push({
        severity: "warning",
        message: `${coverage.missingFrames} frames are missing captured normals.`,
        detail: "Those frames will use transparent placeholders.",
        stage: "capture",
      });
    }
  }

  // Every sheet is packed on its own, so every sheet can fail on its own. The
  // name is only printed when there is more than one — on a single-sheet export
  // it would name a thing the user never had to think about.
  const named = (message: string, sheetName: string) =>
    sheets.length > 1 ? `${sheetName}: ${message}` : message;

  for (const sheet of sheets) {
    if (!sheet.plan) continue;

    const oversizedPage = sheet.plan.pages.find(
      (page) =>
        page.width > options.maxAtlasSize || page.height > options.maxAtlasSize,
    );
    if (oversizedPage) {
      messages.push({
        severity: "error",
        message: named(
          `Atlas page ${oversizedPage.index + 1} exceeds the ${options.maxAtlasSize}px max size.`,
          sheet.name,
        ),
        stage: "pack",
      });
    }

    if (sheet.plan.pages.length > 1 && !MULTI_PAGE_ATLAS_FORMATS.has(format)) {
      messages.push({
        severity: "error",
        message: named(
          "This exporter does not support multi-page atlases yet.",
          sheet.name,
        ),
        detail:
          "Increase max atlas size, disable multi-page, or use the generic spritesheet format.",
        stage: "export",
      });
    }
  }

  return {
    messages,
    blocking: messages.some((message) => message.severity === "error"),
    plan,
    sheets,
  };
}
