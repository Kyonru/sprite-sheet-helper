import type {
  AtlasOptions,
  DirectionalAnimationGroup,
  ExportFile,
  ExportFormat,
  ExportRow,
  ExportRowWorkflowMetadata,
} from "@/types/file";
import type { SpritePostprocessSnapshot } from "@/types/sprite-postprocess";
import JSZip from "jszip";
import {
  atlasPageFileName,
  createAtlasPlan,
  createSpritesheetJSONFromAtlasPlan,
  normalizeAtlasOptions,
  type AtlasPlan,
} from "../atlas";
import { renderAtlasPages } from "../atlas-renderer";
import { applySpritePostprocessRows } from "../sprite-postprocess";
import {
  buildDirectionalAnimationGroups,
  getRowWorkflowMetadata,
} from "../export-row-metadata";
import {
  DEFAULT_SHEET_NAME,
  groupRowsBySheet,
  type SheetGroup,
} from "./sheets";

type BuildSpritesheetAssetsOptions = {
  includeNormalMap?: boolean;
  /** Name of the sheet being built. Defaults to the image's stem. */
  sheetName?: string;
  atlasOptions?: Partial<AtlasOptions>;
  imageName?: string;
  normalImageName?: string;
  exporterId?: ExportFormat;
  spritePostprocess?: SpritePostprocessSnapshot;
};

export type AtlasImageFile = ExportFile & {
  name: string;
  content: string;
  base64: true;
};

export type BuildSpritesheetAssetsResult = {
  json: ReturnType<typeof createSpritesheetJSONFromAtlasPlan>;
  manifest: SpritesheetManifest;
  manifestFile: ExportFile & {
    name: string;
    content: string;
  };
  base64PNG: string;
  normalBase64PNG?: string;
  colorPages: AtlasImageFile[];
  normalPages: AtlasImageFile[];
  plan: AtlasPlan;
  pageCount: number;
};

export type SpritesheetManifest = {
  version: "1.0";
  generatedBy: "sprite-sheet-helper";
  exportedAt: string;
  exporterId: ExportFormat;
  /** The sheet this atlas is, so a multi-sheet export is self-describing. */
  sheet: string;
  sourceFormat: "captured-frames";
  atlas: {
    layout: AtlasOptions["layout"];
    padding: number;
    extrude: number;
    scale: number;
    maxAtlasSize: number;
    allowMultiPage: boolean;
    pageCount: number;
    pages: Array<{
      index: number;
      image: string;
      normalImage?: string;
      width: number;
      height: number;
    }>;
  };
  animations: Array<{
    name: string;
    fps: number;
    frameWidth: number;
    frameHeight: number;
    workflow?: ExportRowWorkflowMetadata;
    frames: Array<{
      index: number;
      page: number;
      image: string;
      normalImage?: string;
      rect: {
        x: number;
        y: number;
        w: number;
        h: number;
      };
      slot: {
        x: number;
        y: number;
        w: number;
        h: number;
      };
      source: {
        width: number;
        height: number;
      };
    }>;
  }>;
  directionalAnimations?: DirectionalAnimationGroup[];
};

export type NormalCoverageStatus = "ready" | "partial" | "missing";

export type NormalCoverage = {
  totalFrames: number;
  normalFrames: number;
  missingFrames: number;
  status: NormalCoverageStatus;
};

export function getNormalCoverage(rows: ExportRow[]): NormalCoverage {
  const totalFrames = rows.reduce((acc, row) => acc + row.images.length, 0);
  const normalFrames = rows.reduce(
    (acc, row) =>
      acc +
      row.images.filter((_, index) => Boolean(row.normalImages?.[index]))
        .length,
    0,
  );
  const missingFrames = totalFrames - normalFrames;

  return {
    totalFrames,
    normalFrames,
    missingFrames,
    status:
      normalFrames === totalFrames && totalFrames > 0
        ? "ready"
        : normalFrames > 0
          ? "partial"
          : "missing",
  };
}

/**
 * How many frames in a sequence repeat the frame before them.
 *
 * Identical neighbours mean the capture spent atlas space on a pose it already
 * had — a window longer than the clip, or a clip that holds still. Either way
 * it is worth saying before the frames are packed.
 */
export function getRepeatedFrameCount(row: ExportRow): number {
  let repeated = 0;

  for (let index = 1; index < row.images.length; index += 1) {
    if (row.images[index] === row.images[index - 1]) repeated += 1;
  }

  return repeated;
}

export function getNormalCoverageForRow(row: ExportRow): NormalCoverage {
  return getNormalCoverage([row]);
}

export async function buildZip(
  populate: (zip: JSZip) => Promise<void> | void,
): Promise<string> {
  const zip = new JSZip();
  await populate(zip);
  return zip.generateAsync({ type: "base64" });
}

function createTransparentFrame(width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas.toDataURL("image/png").split("base64,")[1];
}

/** The file name without its directory or extension. */
function fileStem(name: string): string {
  const slash = name.lastIndexOf("/");
  const base = slash === -1 ? name : name.slice(slash + 1);
  const dot = base.lastIndexOf(".");
  return dot === -1 ? base : base.slice(0, dot);
}

/**
 * The manifest that travels with an atlas image.
 *
 * Named after the image rather than after the format, because an export can now
 * write several atlases side by side: `hero.png` gets `hero.manifest.json`. A
 * single default sheet still writes `spritesheet.manifest.json`, exactly as it
 * always has.
 */
export function spritesheetManifestFileName(
  imageName = "spritesheet.png",
): string {
  const slash = imageName.lastIndexOf("/");
  const prefix = slash === -1 ? "" : imageName.slice(0, slash + 1);

  return `${prefix}${fileStem(imageName)}.manifest.json`;
}

export function createSpritesheetManifest({
  rows,
  plan,
  imageName,
  normalImageName,
  exporterId,
  exportedAt,
  sheetName,
}: {
  rows: ExportRow[];
  plan: AtlasPlan;
  imageName: string;
  normalImageName?: string;
  exporterId: ExportFormat;
  exportedAt: string;
  sheetName?: string;
}): SpritesheetManifest {
  const placementKey = (rowIndex: number, frameIndex: number) =>
    `${rowIndex}:${frameIndex}`;
  const placements = new Map(
    plan.placements.map((placement) => [
      placementKey(placement.rowIndex, placement.frameIndex),
      placement,
    ]),
  );

  const directionalAnimations = buildDirectionalAnimationGroups(rows);

  return {
    version: "1.0",
    generatedBy: "sprite-sheet-helper",
    exportedAt,
    exporterId,
    sheet: sheetName ?? fileStem(imageName),
    sourceFormat: "captured-frames",
    atlas: {
      ...plan.options,
      pageCount: plan.pages.length,
      pages: plan.pages.map((page) => ({
        index: page.index,
        image: atlasPageFileName(imageName, page.index),
        ...(normalImageName
          ? { normalImage: atlasPageFileName(normalImageName, page.index) }
          : {}),
        width: page.width,
        height: page.height,
      })),
    },
    animations: rows.map((row, rowIndex) => {
      const workflow = getRowWorkflowMetadata(row);

      return {
        name: row.label,
        // Not `?? 12`: a row can legitimately carry 0 from an older
        // project, and zero is not nullish, so it used to reach the manifest.
        fps: Number.isFinite(row.fps) && row.fps > 0 ? row.fps : 12,
        frameWidth: Math.max(
          1,
          Math.round(row.frameWidth * plan.options.scale),
        ),
        frameHeight: Math.max(
          1,
          Math.round(row.frameHeight * plan.options.scale),
        ),
        ...(workflow ? { workflow } : {}),
        frames: row.images.map((_, frameIndex) => {
          const placement = placements.get(placementKey(rowIndex, frameIndex));
          if (!placement) {
            throw new Error(
              `Missing atlas placement for ${row.label}:${frameIndex}`,
            );
          }

          return {
            index: frameIndex,
            page: placement.page,
            image: atlasPageFileName(imageName, placement.page),
            ...(normalImageName
              ? {
                  normalImage: atlasPageFileName(
                    normalImageName,
                    placement.page,
                  ),
                }
              : {}),
            rect: {
              x: placement.x,
              y: placement.y,
              w: placement.w,
              h: placement.h,
            },
            slot: {
              x: placement.slotX,
              y: placement.slotY,
              w: placement.slotW,
              h: placement.slotH,
            },
            source: {
              width: row.frameWidth,
              height: row.frameHeight,
            },
          };
        }),
      };
    }),
    ...(directionalAnimations.length > 0 ? { directionalAnimations } : {}),
  };
}

export async function buildSpritesheetAssets(
  exportedImages: ExportRow[],
  options: BuildSpritesheetAssetsOptions = {},
): Promise<BuildSpritesheetAssetsResult> {
  const atlasOptions = normalizeAtlasOptions(options.atlasOptions);
  const imageName = options.imageName ?? "spritesheet.png";
  const normalImageName = options.normalImageName ?? "spritesheet_normal.png";
  const exporterId = options.exporterId ?? "spritesheet";
  const processedRows = await applySpritePostprocessRows(
    exportedImages,
    options.spritePostprocess,
  );
  const plan = createAtlasPlan(processedRows, atlasOptions);
  const colorDataUrls = await renderAtlasPages(
    processedRows,
    plan,
    atlasOptions,
  );
  const colorPages = colorDataUrls.map((dataUrl, index) => ({
    name: atlasPageFileName(imageName, index),
    content: dataUrl.split("base64,")[1],
    base64: true as const,
  }));
  const transparentFrames = new Map<string, string>();
  const normalRows = options.includeNormalMap
    ? processedRows.map((row) => ({
        ...row,
        images: row.images.map((_, index) => {
          const normalImage = row.normalImages?.[index];
          if (normalImage) return normalImage;

          const cacheKey = `${row.frameWidth}x${row.frameHeight}`;
          const cachedFrame = transparentFrames.get(cacheKey);
          if (cachedFrame) return cachedFrame;

          const transparentFrame = createTransparentFrame(
            row.frameWidth,
            row.frameHeight,
          );
          transparentFrames.set(cacheKey, transparentFrame);
          return transparentFrame;
        }),
      }))
    : [];
  const hasNormalImages =
    options.includeNormalMap && normalRows.length === processedRows.length;
  const json = createSpritesheetJSONFromAtlasPlan(
    processedRows,
    plan,
    imageName,
    hasNormalImages ? normalImageName : undefined,
  );
  if (hasNormalImages) {
    json.meta.normalImage = normalImageName;
  }
  const normalPages = hasNormalImages
    ? (await renderAtlasPages(normalRows, plan, atlasOptions)).map(
        (dataUrl, index) => ({
          name: atlasPageFileName(normalImageName, index),
          content: dataUrl.split("base64,")[1],
          base64: true as const,
        }),
      )
    : [];
  if (hasNormalImages && normalPages.length !== colorPages.length) {
    throw new Error(
      "Normal atlas page count does not match the color atlas page count.",
    );
  }
  const manifest = createSpritesheetManifest({
    rows: processedRows,
    plan,
    imageName,
    sheetName: options.sheetName,
    normalImageName: hasNormalImages ? normalImageName : undefined,
    exporterId,
    exportedAt: json.meta.exportedAt,
  });
  const manifestFile = {
    name: spritesheetManifestFileName(imageName),
    content: JSON.stringify(manifest, null, 2),
  };

  return {
    json,
    manifest,
    manifestFile,
    base64PNG: colorPages[0]?.content ?? "",
    normalBase64PNG: normalPages[0]?.content,
    colorPages,
    normalPages,
    plan,
    pageCount: plan.pages.length,
  };
}

/**
 * One sheet's worth of built assets, plus the paths its files were named with.
 */
export type SheetAssets = SheetGroup & {
  imagePath: string;
  normalImagePath: string;
  assets: BuildSpritesheetAssetsResult;
  /** Whether this export writes more than one sheet. */
  multi: boolean;
};

/**
 * Pack and render every sheet in an export.
 *
 * Each sheet is an independent atlas: its own packing, its own pages, its own
 * manifest, named after the sheet. Exporters map over the result instead of
 * building one atlas, which is the whole of what grouping costs them — the
 * generated code for a single sheet is unchanged, because a lone default sheet
 * still produces `spritesheet.png` and friends.
 */
export async function buildSheetAssets(
  exportedImages: ExportRow[],
  options: BuildSpritesheetAssetsOptions & {
    /** Directory every file for this exporter lives in, e.g. `assets/`. */
    directory?: string;
  } = {},
): Promise<SheetAssets[]> {
  const groups = groupRowsBySheet(exportedImages);
  // An export with no rows still has one (empty) sheet: exporters that render
  // it produce the same empty atlas they did before grouping existed, rather
  // than a zip with no atlas in it at all.
  const sheets =
    groups.length > 0
      ? groups
      : [{ name: DEFAULT_SHEET_NAME, base: DEFAULT_SHEET_NAME, rows: [] }];
  const directory = options.directory ?? "";
  const multi = sheets.length > 1;
  const built: SheetAssets[] = [];

  for (const sheet of sheets) {
    const imagePath = `${directory}${sheet.base}.png`;
    const normalImagePath = `${directory}${sheet.base}_normal.png`;

    built.push({
      ...sheet,
      imagePath,
      normalImagePath,
      multi,
      assets: await buildSpritesheetAssets(sheet.rows, {
        ...options,
        sheetName: sheet.name,
        imageName: imagePath,
        normalImageName: normalImagePath,
      }),
    });
  }

  return built;
}

export function createNormalMapFile(
  normalBase64PNG: string | undefined,
  name = "spritesheet_normal.png",
): ExportFile[] {
  return normalBase64PNG
    ? [{ name, content: normalBase64PNG, base64: true }]
    : [];
}

/**
 * The image files one sheet writes: its atlas page, and its normal map when the
 * export has one. Every engine exporter starts its file list with these, then
 * adds the manifest and its own generated code in whatever order it writes.
 */
export function sheetImageFiles(sheet: SheetAssets): ExportFile[] {
  return [
    { name: sheet.imagePath, content: sheet.assets.base64PNG, base64: true },
    ...createNormalMapFile(sheet.assets.normalBase64PNG, sheet.normalImagePath),
  ];
}

export function assertSinglePageAtlas(
  assets: BuildSpritesheetAssetsResult,
  label: string,
): void {
  if (assets.pageCount <= 1) return;
  throw new Error(
    `${label} does not support multi-page atlases yet. Increase max atlas size, disable multi-page, or export the generic spritesheet format.`,
  );
}

/**
 * Make a list of output file names unique.
 *
 * Sequences are free to share a label — two rows both called "Animation" is
 * normal — but the files they produce are not. Left alone, the second
 * `Animation.gif` silently overwrites the first inside the archive, so an
 * export of two sequences yields one file and no error.
 *
 * Collisions get a numeric suffix before the extension: `Animation.gif`,
 * `Animation-2.gif`. The first occurrence keeps its plain name so the common
 * case is unchanged.
 */
export function dedupeFileNames(names: string[]): string[] {
  const seen = new Map<string, number>();

  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;

    const slash = name.lastIndexOf("/");
    const dir = slash === -1 ? "" : name.slice(0, slash + 1);
    const base = slash === -1 ? name : name.slice(slash + 1);
    const dot = base.indexOf(".");
    const stem = dot === -1 ? base : base.slice(0, dot);
    const ext = dot === -1 ? "" : base.slice(dot);

    return `${dir}${stem}-${count + 1}${ext}`;
  });
}

/**
 * Frames per second for a capture interval in milliseconds.
 *
 * Rounding to a whole number loses the interval badly at the slow end: a 700ms
 * interval rounds to 1fps and plays back at 1000ms, and anything past 2000ms
 * rounds to **0**, which reaches the exported manifest as `fps: 0` — a value no
 * consumer can use, and one that `?? 12` does not catch because zero is not
 * nullish.
 *
 * Six decimals round-trips every interval the UI allows to well under a
 * millisecond, without emitting a seventeen-digit float into someone's asset
 * pipeline. Whole-number rates stay whole: 100ms is still exactly 10. Three
 * decimals was not enough — a 3000ms interval came back as 3003ms.
 */
export function fpsFromCaptureInterval(intervalMs: number): number {
  const interval =
    Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 100;
  return Math.round((1000 / interval) * 1e6) / 1e6;
}

/**
 * Playback interval in milliseconds for a row's frame rate, for previews.
 * Falls back to 12fps when a row carries no usable rate.
 */
export function captureIntervalFromFps(fps: number | undefined): number {
  const rate = Number.isFinite(fps) && (fps ?? 0) > 0 ? (fps as number) : 12;
  return 1000 / rate;
}
