import type { ExportFile, ExportRow } from "@/types/file";
import { createSpriteSheet, createSpritesheetJSON } from "../assets";
import JSZip from "jszip";

type BuildSpritesheetAssetsOptions = {
  includeNormalMap?: boolean;
  normalImageName?: string;
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
) {
  const dataUrl = await createSpriteSheet(exportedImages);
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
    : exportedImages
        .filter(
          (row) =>
            row.normalImages !== undefined &&
            row.normalImages.length === row.images.length,
        )
        .map((row) => ({ ...row, images: row.normalImages ?? [] }));
  const hasNormalImages =
    normalRows.length === exportedImages.length &&
    (options.includeNormalMap || normalRows.length > 0);
  const json = createSpritesheetJSON(exportedImages);
  if (hasNormalImages) {
    json.meta.normalImage = options.normalImageName ?? "spritesheet_normal.png";
  }
  const base64PNG = dataUrl.split("base64,")[1];
  const normalBase64PNG = hasNormalImages
    ? (await createSpriteSheet(normalRows)).split("base64,")[1]
    : undefined;
  return { json, base64PNG, normalBase64PNG };
}

export function createNormalMapFile(
  normalBase64PNG: string | undefined,
  name = "spritesheet_normal.png",
): ExportFile[] {
  return normalBase64PNG
    ? [{ name, content: normalBase64PNG, base64: true }]
    : [];
}
