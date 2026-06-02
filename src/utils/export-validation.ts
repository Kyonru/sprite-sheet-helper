import type { AtlasOptions, ExportFormat, ExportRow } from "@/types/file";
import {
  ATLAS_EXPORT_FORMATS,
  MULTI_PAGE_ATLAS_FORMATS,
  createAtlasPlan,
  normalizeAtlasOptions,
  type AtlasPlan,
} from "./atlas";
import { getNormalCoverage } from "./exports/helpers";

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

export type ExportValidationMessage = {
  severity: ExportValidationSeverity;
  message: string;
};

export type ExportValidationResult = {
  messages: ExportValidationMessage[];
  blocking: boolean;
  plan: AtlasPlan | null;
};

export type ExportSummary = {
  animationCount: number;
  frameCount: number;
  pageCount: number;
  imageWidth: number;
  imageHeight: number;
  normalStatus: ReturnType<typeof getNormalCoverage>["status"];
};

export function getExportSummary(
  rows: ExportRow[],
  options: Partial<AtlasOptions> = {},
): ExportSummary {
  const frameCount = rows.reduce((acc, row) => acc + row.images.length, 0);
  const plan = frameCount > 0 ? createAtlasPlan(rows, options) : null;
  const normalCoverage = getNormalCoverage(rows);

  return {
    animationCount: rows.length,
    frameCount,
    pageCount: plan?.pages.length ?? 0,
    imageWidth: plan?.pages[0]?.width ?? 0,
    imageHeight: plan?.pages[0]?.height ?? 0,
    normalStatus: normalCoverage.status,
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
    });
    return { messages, blocking: true, plan: null };
  }

  for (const row of rows) {
    if (row.frameWidth <= 0 || row.frameHeight <= 0) {
      messages.push({
        severity: "error",
        message: `Sequence "${row.label}" has an invalid frame size.`,
      });
    }
  }

  const plan = ATLAS_EXPORT_FORMATS.has(format)
    ? createAtlasPlan(rows, options)
    : null;

  if (includeNormalMap && !NORMAL_MAP_EXPORT_FORMATS.has(format)) {
    messages.push({
      severity: "warning",
      message: `${format} does not emit a normal-map atlas.`,
    });
  }

  if (includeNormalMap && NORMAL_MAP_EXPORT_FORMATS.has(format)) {
    const coverage = getNormalCoverage(rows);
    if (coverage.totalFrames > 0 && coverage.normalFrames === 0) {
      messages.push({
        severity: "warning",
        message:
          "No frames have captured normals; the normal atlas will use transparent placeholders.",
      });
    } else if (coverage.missingFrames > 0) {
      messages.push({
        severity: "warning",
        message: `${coverage.missingFrames} frames are missing captured normals and will use transparent placeholders.`,
      });
    }
  }

  if (plan) {
    const oversizedPage = plan.pages.find(
      (page) =>
        page.width > options.maxAtlasSize || page.height > options.maxAtlasSize,
    );
    if (oversizedPage) {
      messages.push({
        severity: "error",
        message: `Atlas page ${oversizedPage.index + 1} exceeds the ${options.maxAtlasSize}px max size.`,
      });
    }

    if (
      plan.pages.length > 1 &&
      !MULTI_PAGE_ATLAS_FORMATS.has(format)
    ) {
      messages.push({
        severity: "error",
        message:
          "This exporter does not support multi-page atlases yet. Increase max atlas size, disable multi-page, or use the generic spritesheet format.",
      });
    }
  }

  return {
    messages,
    blocking: messages.some((message) => message.severity === "error"),
    plan,
  };
}
