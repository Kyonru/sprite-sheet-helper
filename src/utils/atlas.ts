import type { AtlasOptions, ExportFormat, ExportRow } from "@/types/file";
import type { SpritesheetJSON } from "./assets";
import {
  buildDirectionalAnimationGroups,
  getRowWorkflowMetadata,
} from "./export-row-metadata";

export const DEFAULT_ATLAS_OPTIONS: AtlasOptions = {
  layout: "rows",
  padding: 0,
  extrude: 0,
  scale: 1,
  maxAtlasSize: 2048,
  allowMultiPage: false,
};

export const ATLAS_EXPORT_FORMATS = new Set<ExportFormat>([
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

export const MULTI_PAGE_ATLAS_FORMATS = new Set<ExportFormat>(["spritesheet"]);

export type AtlasPage = {
  index: number;
  width: number;
  height: number;
};

export type AtlasPlacement = {
  rowIndex: number;
  frameIndex: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  slotX: number;
  slotY: number;
  slotW: number;
  slotH: number;
};

export type AtlasPlan = {
  options: AtlasOptions;
  pages: AtlasPage[];
  placements: AtlasPlacement[];
};

export type AtlasFrameSlotSize = {
  w: number;
  h: number;
  slotW: number;
  slotH: number;
};

type PendingFrame = AtlasFrameSlotSize & {
  rowIndex: number;
  frameIndex: number;
};

type MutablePage = AtlasPage & {
  placements: AtlasPlacement[];
};

type FreeRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type MaxRectsPage = MutablePage & {
  freeRects: FreeRect[];
};

type MaxRectsCandidate = {
  page: MaxRectsPage;
  rect: FreeRect;
  shortSideFit: number;
  longSideFit: number;
  areaFit: number;
};

function positiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value ?? fallback));
}

export function normalizeAtlasOptions(
  options: Partial<AtlasOptions> = {},
): AtlasOptions {
  return {
    layout: options.layout === "packed" ? "packed" : "rows",
    padding: positiveInteger(options.padding, DEFAULT_ATLAS_OPTIONS.padding),
    extrude: positiveInteger(options.extrude, DEFAULT_ATLAS_OPTIONS.extrude),
    scale:
      Number.isFinite(options.scale) && (options.scale ?? 0) > 0
        ? Number(options.scale)
        : DEFAULT_ATLAS_OPTIONS.scale,
    maxAtlasSize: Math.max(
      1,
      positiveInteger(options.maxAtlasSize, DEFAULT_ATLAS_OPTIONS.maxAtlasSize),
    ),
    allowMultiPage: Boolean(options.allowMultiPage),
  };
}

function scaledSize(value: number, scale: number): number {
  return Math.max(1, Math.round(value * scale));
}

export function getAtlasFrameSlotSize(
  row: ExportRow,
  options: Partial<AtlasOptions> = {},
): AtlasFrameSlotSize {
  const normalized = normalizeAtlasOptions(options);
  const gutter = normalized.padding + normalized.extrude;
  const w = scaledSize(row.frameWidth, normalized.scale);
  const h = scaledSize(row.frameHeight, normalized.scale);

  return {
    w,
    h,
    slotW: w + gutter * 2,
    slotH: h + gutter * 2,
  };
}

function flattenRows(rows: ExportRow[], options: AtlasOptions): PendingFrame[] {
  return rows.flatMap((row, rowIndex) => {
    const { w, h, slotW, slotH } = getAtlasFrameSlotSize(row, options);

    return row.images.map((_, frameIndex) => ({
      rowIndex,
      frameIndex,
      w,
      h,
      slotW,
      slotH,
    }));
  });
}

function createPage(index: number): MutablePage {
  return {
    index,
    width: 0,
    height: 0,
    placements: [],
  };
}

function createMaxRectsPage(index: number, size: number): MaxRectsPage {
  const page = createPage(index) as MaxRectsPage;
  page.freeRects = [{ x: 0, y: 0, w: size, h: size }];
  return page;
}

function addPlacement(
  page: MutablePage,
  frame: PendingFrame,
  x: number,
  y: number,
  options: AtlasOptions,
) {
  const contentOffset = options.padding + options.extrude;
  const placement: AtlasPlacement = {
    rowIndex: frame.rowIndex,
    frameIndex: frame.frameIndex,
    page: page.index,
    x: x + contentOffset,
    y: y + contentOffset,
    w: frame.w,
    h: frame.h,
    slotX: x,
    slotY: y,
    slotW: frame.slotW,
    slotH: frame.slotH,
  };

  page.placements.push(placement);
  page.width = Math.max(page.width, x + frame.slotW);
  page.height = Math.max(page.height, y + frame.slotH);
}

function buildRowsPlan(rows: ExportRow[], options: AtlasOptions): AtlasPlan {
  const pages = [createPage(0)];
  let page = pages[0];

  if (!options.allowMultiPage) {
    let y = 0;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const rowFrames = flattenRows([rows[rowIndex]], options).map(
        (frame) => ({
          ...frame,
          rowIndex,
        }),
      );
      let x = 0;
      let rowHeight = 0;
      for (const frame of rowFrames) {
        addPlacement(page, frame, x, y, options);
        x += frame.slotW;
        rowHeight = Math.max(rowHeight, frame.slotH);
      }
      y += rowHeight;
    }
  } else {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const rowFrames = flattenRows([rows[rowIndex]], options).map((frame) => ({
        ...frame,
        rowIndex,
      }));
      let x = 0;
      let y = page.height;
      let shelfHeight = 0;

      for (const frame of rowFrames) {
        if (x > 0 && x + frame.slotW > options.maxAtlasSize) {
          x = 0;
          y += shelfHeight;
          shelfHeight = 0;
        }

        if (
          page.placements.length > 0 &&
          y + frame.slotH > options.maxAtlasSize
        ) {
          page = createPage(pages.length);
          pages.push(page);
          x = 0;
          y = 0;
          shelfHeight = 0;
        }

        addPlacement(page, frame, x, y, options);
        x += frame.slotW;
        shelfHeight = Math.max(shelfHeight, frame.slotH);
      }
    }
  }

  return finishPlan(pages, options);
}

function buildPackedPlan(rows: ExportRow[], options: AtlasOptions): AtlasPlan {
  const frames = flattenRows(rows, options).sort(
    (a, b) =>
      b.slotH - a.slotH ||
      b.slotW - a.slotW ||
      a.rowIndex - b.rowIndex ||
      a.frameIndex - b.frameIndex,
  );

  if (frames.length === 0) {
    return finishPlan([], options);
  }

  if (options.allowMultiPage) {
    const result = packFramesIntoMaxRectsPages(
      frames,
      options,
      options.maxAtlasSize,
      true,
    );
    return finishPlan(result.pages, options);
  }

  let pageSize = getInitialPackedPageSize(frames);
  for (let attempt = 0; attempt < frames.length + 16; attempt += 1) {
    const result = packFramesIntoMaxRectsPages(
      frames,
      options,
      pageSize,
      false,
    );

    if (!result.failedFrame) {
      return finishPlan(result.pages, options);
    }

    pageSize = Math.max(
      pageSize + 1,
      Math.ceil(pageSize * 1.25),
      result.failedFrame.slotW,
      result.failedFrame.slotH,
    );
  }

  const fallbackSize = Math.max(
    1,
    frames.reduce((totalWidth, frame) => totalWidth + frame.slotW, 0),
    ...frames.map((frame) => frame.slotH),
  );
  const fallback = packFramesIntoMaxRectsPages(
    frames,
    options,
    fallbackSize,
    false,
  );
  if (fallback.failedFrame) {
    throw new Error("Unable to create a packed atlas plan.");
  }
  return finishPlan(fallback.pages, options);
}

function getInitialPackedPageSize(frames: PendingFrame[]): number {
  const totalArea = frames.reduce(
    (area, frame) => area + frame.slotW * frame.slotH,
    0,
  );
  const maxDimension = Math.max(
    1,
    ...frames.flatMap((frame) => [frame.slotW, frame.slotH]),
  );

  return Math.max(maxDimension, Math.ceil(Math.sqrt(totalArea)));
}

function packFramesIntoMaxRectsPages(
  frames: PendingFrame[],
  options: AtlasOptions,
  pageSize: number,
  allowNewPages: boolean,
): { pages: MaxRectsPage[]; failedFrame?: PendingFrame } {
  const pages = [createMaxRectsPage(0, pageSize)];

  for (const frame of frames) {
    let candidate = findBestMaxRectsCandidate(pages, frame);

    if (!candidate && allowNewPages) {
      const nextPageSize = Math.max(
        options.maxAtlasSize,
        frame.slotW,
        frame.slotH,
      );
      const currentPage = pages[pages.length - 1];
      const nextPage =
        currentPage.placements.length === 0
          ? createMaxRectsPage(currentPage.index, nextPageSize)
          : createMaxRectsPage(pages.length, nextPageSize);
      if (currentPage.placements.length === 0) {
        pages[pages.length - 1] = nextPage;
      } else {
        pages.push(nextPage);
      }
      candidate = findBestMaxRectsCandidate([nextPage], frame);
    }

    if (!candidate) {
      return { pages, failedFrame: frame };
    }

    placeMaxRectsFrame(candidate, frame, options);
  }

  return { pages };
}

function findBestMaxRectsCandidate(
  pages: MaxRectsPage[],
  frame: PendingFrame,
): MaxRectsCandidate | null {
  let best: MaxRectsCandidate | null = null;

  for (const page of pages) {
    for (const rect of page.freeRects) {
      if (frame.slotW > rect.w || frame.slotH > rect.h) continue;

      const leftoverW = rect.w - frame.slotW;
      const leftoverH = rect.h - frame.slotH;
      const candidate: MaxRectsCandidate = {
        page,
        rect,
        shortSideFit: Math.min(leftoverW, leftoverH),
        longSideFit: Math.max(leftoverW, leftoverH),
        areaFit: rect.w * rect.h - frame.slotW * frame.slotH,
      };

      if (!best || compareMaxRectsCandidates(candidate, best) < 0) {
        best = candidate;
      }
    }
  }

  return best;
}

function compareMaxRectsCandidates(
  a: MaxRectsCandidate,
  b: MaxRectsCandidate,
): number {
  return (
    a.shortSideFit - b.shortSideFit ||
    a.longSideFit - b.longSideFit ||
    a.areaFit - b.areaFit ||
    a.page.index - b.page.index ||
    a.rect.y - b.rect.y ||
    a.rect.x - b.rect.x ||
    a.rect.h - b.rect.h ||
    a.rect.w - b.rect.w
  );
}

function placeMaxRectsFrame(
  candidate: MaxRectsCandidate,
  frame: PendingFrame,
  options: AtlasOptions,
) {
  const usedRect: FreeRect = {
    x: candidate.rect.x,
    y: candidate.rect.y,
    w: frame.slotW,
    h: frame.slotH,
  };

  addPlacement(candidate.page, frame, usedRect.x, usedRect.y, options);
  splitMaxRectsFreeRects(candidate.page, usedRect);
}

function splitMaxRectsFreeRects(page: MaxRectsPage, used: FreeRect) {
  const nextRects: FreeRect[] = [];

  for (const rect of page.freeRects) {
    if (!rectsIntersect(rect, used)) {
      nextRects.push(rect);
      continue;
    }

    const rectRight = rect.x + rect.w;
    const rectBottom = rect.y + rect.h;
    const usedRight = used.x + used.w;
    const usedBottom = used.y + used.h;

    if (used.x > rect.x) {
      nextRects.push({
        x: rect.x,
        y: rect.y,
        w: used.x - rect.x,
        h: rect.h,
      });
    }

    if (usedRight < rectRight) {
      nextRects.push({
        x: usedRight,
        y: rect.y,
        w: rectRight - usedRight,
        h: rect.h,
      });
    }

    if (used.y > rect.y) {
      nextRects.push({
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: used.y - rect.y,
      });
    }

    if (usedBottom < rectBottom) {
      nextRects.push({
        x: rect.x,
        y: usedBottom,
        w: rect.w,
        h: rectBottom - usedBottom,
      });
    }
  }

  page.freeRects = pruneFreeRects(nextRects);
}

function rectsIntersect(a: FreeRect, b: FreeRect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function pruneFreeRects(rects: FreeRect[]): FreeRect[] {
  const positiveRects = rects.filter((rect) => rect.w > 0 && rect.h > 0);
  const pruned = positiveRects.filter(
    (rect, index) =>
      !positiveRects.some(
        (other, otherIndex) =>
          otherIndex !== index && rectContainedIn(rect, other),
      ),
  );

  return pruned.sort(
    (a, b) => a.y - b.y || a.x - b.x || a.h - b.h || a.w - b.w,
  );
}

function rectContainedIn(rect: FreeRect, other: FreeRect): boolean {
  return (
    rect.x >= other.x &&
    rect.y >= other.y &&
    rect.x + rect.w <= other.x + other.w &&
    rect.y + rect.h <= other.y + other.h
  );
}

function finishPlan(pages: MutablePage[], options: AtlasOptions): AtlasPlan {
  const placements = pages
    .flatMap((page) => page.placements)
    .sort(
      (a, b) =>
        a.rowIndex - b.rowIndex ||
        a.frameIndex - b.frameIndex ||
        a.page - b.page,
    );

  return {
    options,
    pages: pages
      .filter((page) => page.placements.length > 0)
      .map((page) => ({
        index: page.index,
        width: Math.max(1, Math.ceil(page.width)),
        height: Math.max(1, Math.ceil(page.height)),
      })),
    placements,
  };
}

export function createAtlasPlan(
  rows: ExportRow[],
  options: Partial<AtlasOptions> = {},
): AtlasPlan {
  const normalized = normalizeAtlasOptions(options);
  if (normalized.layout === "packed") {
    return buildPackedPlan(rows, normalized);
  }
  return buildRowsPlan(rows, normalized);
}

export function atlasPageFileName(baseName: string, pageIndex: number): string {
  if (pageIndex === 0) return baseName;
  const dot = baseName.lastIndexOf(".");
  if (dot === -1) return `${baseName}_${pageIndex + 1}`;
  return `${baseName.slice(0, dot)}_${pageIndex + 1}${baseName.slice(dot)}`;
}

export function createSpritesheetJSONFromAtlasPlan(
  rows: ExportRow[],
  plan: AtlasPlan,
  imageName = "spritesheet.png",
  normalImageName?: string,
): SpritesheetJSON {
  const placementKey = (rowIndex: number, frameIndex: number) =>
    `${rowIndex}:${frameIndex}`;
  const placements = new Map(
    plan.placements.map((placement) => [
      placementKey(placement.rowIndex, placement.frameIndex),
      placement,
    ]),
  );
  const multiPage = plan.pages.length > 1;
  const meta: SpritesheetJSON["meta"] = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    imageWidth: plan.pages[0]?.width ?? 0,
    imageHeight: plan.pages[0]?.height ?? 0,
    frameCount: rows.reduce((acc, row) => acc + row.images.length, 0),
    animationCount: rows.length,
    spacing: plan.options.padding * 2 + plan.options.extrude * 2,
    margin: 0,
  };

  if (normalImageName) {
    meta.normalImage = normalImageName;
  }

  if (multiPage) {
    meta.pages = plan.pages.map((page) => {
      const entry: NonNullable<SpritesheetJSON["meta"]["pages"]>[number] = {
        index: page.index,
        image: atlasPageFileName(imageName, page.index),
        width: page.width,
        height: page.height,
      };
      if (normalImageName) {
        entry.normalImage = atlasPageFileName(normalImageName, page.index);
      }
      return entry;
    });
  }

  const directionalAnimations = buildDirectionalAnimationGroups(rows);

  return {
    meta,
    animations: rows.map((row, rowIndex) => {
      const workflow = getRowWorkflowMetadata(row);

      return {
        name: row.label,
        frames: row.images.length,
        fps: row.fps ?? 12,
        frameWidth: Math.max(1, Math.round(row.frameWidth * plan.options.scale)),
        frameHeight: Math.max(
          1,
          Math.round(row.frameHeight * plan.options.scale),
        ),
        ...(workflow ? { workflow } : {}),
        quads: row.images.map((_, frameIndex) => {
          const placement = placements.get(placementKey(rowIndex, frameIndex));
          if (!placement) {
            throw new Error(
              `Missing atlas placement for ${row.label}:${frameIndex}`,
            );
          }

          const quad = {
            x: placement.x,
            y: placement.y,
            w: placement.w,
            h: placement.h,
          };
          return multiPage ? { ...quad, page: placement.page } : quad;
        }),
      };
    }),
    ...(directionalAnimations.length > 0 ? { directionalAnimations } : {}),
  };
}
