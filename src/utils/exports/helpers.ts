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

type BuildSpritesheetAssetsOptions = {
  includeNormalMap?: boolean;
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

export function spritesheetManifestFileName(
  imageName = "spritesheet.png",
): string {
  const slash = imageName.lastIndexOf("/");
  const prefix = slash === -1 ? "" : imageName.slice(0, slash + 1);
  return `${prefix}spritesheet.manifest.json`;
}

export function createSpritesheetManifest({
  rows,
  plan,
  imageName,
  normalImageName,
  exporterId,
  exportedAt,
}: {
  rows: ExportRow[];
  plan: AtlasPlan;
  imageName: string;
  normalImageName?: string;
  exporterId: ExportFormat;
  exportedAt: string;
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
        fps: row.fps ?? 12,
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
  const normalImageName =
    options.normalImageName ?? "spritesheet_normal.png";
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

export function createNormalMapFile(
  normalBase64PNG: string | undefined,
  name = "spritesheet_normal.png",
): ExportFile[] {
  return normalBase64PNG
    ? [{ name, content: normalBase64PNG, base64: true }]
    : [];
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
