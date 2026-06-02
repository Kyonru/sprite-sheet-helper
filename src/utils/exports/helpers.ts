import type { ExportFile, ExportRow } from "@/types/file";
import JSZip from "jszip";
import {
  atlasPageFileName,
  createAtlasPlan,
  createSpritesheetJSONFromAtlasPlan,
  normalizeAtlasOptions,
  type AtlasPlan,
} from "../atlas";
import { renderAtlasPages } from "../atlas-renderer";
import type { AtlasOptions } from "@/types/file";

type BuildSpritesheetAssetsOptions = {
  includeNormalMap?: boolean;
  atlasOptions?: Partial<AtlasOptions>;
  imageName?: string;
  normalImageName?: string;
};

export type AtlasImageFile = ExportFile & {
  name: string;
  content: string;
  base64: true;
};

export type BuildSpritesheetAssetsResult = {
  json: ReturnType<typeof createSpritesheetJSONFromAtlasPlan>;
  base64PNG: string;
  normalBase64PNG?: string;
  colorPages: AtlasImageFile[];
  normalPages: AtlasImageFile[];
  plan: AtlasPlan;
  pageCount: number;
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

export async function buildSpritesheetAssets(
  exportedImages: ExportRow[],
  options: BuildSpritesheetAssetsOptions = {},
): Promise<BuildSpritesheetAssetsResult> {
  const atlasOptions = normalizeAtlasOptions(options.atlasOptions);
  const imageName = options.imageName ?? "spritesheet.png";
  const normalImageName =
    options.normalImageName ?? "spritesheet_normal.png";
  const plan = createAtlasPlan(exportedImages, atlasOptions);
  const colorDataUrls = await renderAtlasPages(exportedImages, plan, atlasOptions);
  const colorPages = colorDataUrls.map((dataUrl, index) => ({
    name: atlasPageFileName(imageName, index),
    content: dataUrl.split("base64,")[1],
    base64: true as const,
  }));
  const transparentFrames = new Map<string, string>();
  const normalRows = options.includeNormalMap
    ? exportedImages.map((row) => ({
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
    options.includeNormalMap && normalRows.length === exportedImages.length;
  const json = createSpritesheetJSONFromAtlasPlan(
    exportedImages,
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

  return {
    json,
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
