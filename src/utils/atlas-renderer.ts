import type { AtlasOptions, ExportRow } from "@/types/file";
import type { AtlasPlan, AtlasPlacement } from "./atlas";

function asDataUrl(src: string): string {
  return src.startsWith("data:image") ? src : `data:image/png;base64,${src}`;
}

async function loadAtlasImages(rows: ExportRow[]) {
  return Promise.all(
    rows.map((row) =>
      Promise.all(
        row.images.map(
          (src) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error("Failed to load frame"));
              img.src = asDataUrl(src);
            }),
        ),
      ),
    ),
  );
}

function drawExtrusion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  placement: AtlasPlacement,
  extrude: number,
) {
  if (extrude <= 0) return;

  const { x, y, w, h } = placement;
  const sourceW = img.naturalWidth || img.width;
  const sourceH = img.naturalHeight || img.height;

  ctx.drawImage(img, 0, 0, sourceW, 1, x, y - extrude, w, extrude);
  ctx.drawImage(img, 0, sourceH - 1, sourceW, 1, x, y + h, w, extrude);
  ctx.drawImage(img, 0, 0, 1, sourceH, x - extrude, y, extrude, h);
  ctx.drawImage(img, sourceW - 1, 0, 1, sourceH, x + w, y, extrude, h);

  ctx.drawImage(img, 0, 0, 1, 1, x - extrude, y - extrude, extrude, extrude);
  ctx.drawImage(img, sourceW - 1, 0, 1, 1, x + w, y - extrude, extrude, extrude);
  ctx.drawImage(img, 0, sourceH - 1, 1, 1, x - extrude, y + h, extrude, extrude);
  ctx.drawImage(
    img,
    sourceW - 1,
    sourceH - 1,
    1,
    1,
    x + w,
    y + h,
    extrude,
    extrude,
  );
}

export async function renderAtlasPages(
  rows: ExportRow[],
  plan: AtlasPlan,
  options: AtlasOptions,
): Promise<string[]> {
  const loaded = await loadAtlasImages(rows);

  const dataUrls = plan.pages.map((page) => {
    const canvas = document.createElement("canvas");
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    for (const placement of plan.placements.filter(
      (item) => item.page === page.index,
    )) {
      const img = loaded[placement.rowIndex]?.[placement.frameIndex];
      if (!img) continue;
      drawExtrusion(ctx, img, placement, options.extrude);
      ctx.drawImage(img, placement.x, placement.y, placement.w, placement.h);
    }

    return canvas.toDataURL("image/png");
  });

  for (const rowImages of loaded) {
    for (const img of rowImages) {
      img.src = "";
    }
  }

  return dataUrls;
}
