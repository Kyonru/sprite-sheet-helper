import type { AtlasOptions, ExportFormat, ExportRow } from "@/types/file";
import type { SpritesheetJSON } from "./assets";

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

type PendingFrame = {
  rowIndex: number;
  frameIndex: number;
  w: number;
  h: number;
  slotW: number;
  slotH: number;
};

type MutablePage = AtlasPage & {
  placements: AtlasPlacement[];
  shelfY: number;
  shelfHeight: number;
  shelfX: number;
};

type Shelf = {
  page: number;
  x: number;
  y: number;
  height: number;
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

function flattenRows(rows: ExportRow[], options: AtlasOptions): PendingFrame[] {
  const gutter = options.padding + options.extrude;

  return rows.flatMap((row, rowIndex) => {
    const w = scaledSize(row.frameWidth, options.scale);
    const h = scaledSize(row.frameHeight, options.scale);
    const slotW = w + gutter * 2;
    const slotH = h + gutter * 2;

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
    shelfY: 0,
    shelfHeight: 0,
    shelfX: 0,
  };
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
    for (const row of rows) {
      const rowFrames = flattenRows([row], options);
      let x = 0;
      let rowHeight = 0;
      for (const frame of rowFrames) {
        const withGlobalIndex = {
          ...frame,
          rowIndex: rows.indexOf(row),
        };
        addPlacement(page, withGlobalIndex, x, y, options);
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

function tryPlaceOnShelf(
  pages: MutablePage[],
  shelves: Shelf[],
  frame: PendingFrame,
  options: AtlasOptions,
): boolean {
  for (const shelf of shelves) {
    if (
      frame.slotH <= shelf.height &&
      shelf.x + frame.slotW <= options.maxAtlasSize
    ) {
      const page = pages[shelf.page];
      addPlacement(page, frame, shelf.x, shelf.y, options);
      shelf.x += frame.slotW;
      return true;
    }
  }

  return false;
}

function addShelf(
  pages: MutablePage[],
  shelves: Shelf[],
  frame: PendingFrame,
  options: AtlasOptions,
) {
  let page = pages[pages.length - 1];
  const canUseCurrentPage =
    page.placements.length === 0 ||
    !options.allowMultiPage ||
    page.height + frame.slotH <= options.maxAtlasSize;

  if (!canUseCurrentPage) {
    page = createPage(pages.length);
    pages.push(page);
  }

  const shelf: Shelf = {
    page: page.index,
    x: 0,
    y: page.height,
    height: frame.slotH,
  };
  shelves.push(shelf);
  addPlacement(page, frame, shelf.x, shelf.y, options);
  shelf.x += frame.slotW;
}

function buildPackedPlan(rows: ExportRow[], options: AtlasOptions): AtlasPlan {
  const frames = flattenRows(rows, options).sort(
    (a, b) =>
      b.slotH - a.slotH ||
      b.slotW - a.slotW ||
      a.rowIndex - b.rowIndex ||
      a.frameIndex - b.frameIndex,
  );
  const pages = [createPage(0)];
  const shelves: Shelf[] = [];

  for (const frame of frames) {
    if (tryPlaceOnShelf(pages, shelves, frame, options)) continue;
    addShelf(pages, shelves, frame, options);
  }

  return finishPlan(pages, options);
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

  return {
    meta,
    animations: rows.map((row, rowIndex) => ({
      name: row.label,
      frames: row.images.length,
      fps: row.fps ?? 12,
      frameWidth: Math.max(1, Math.round(row.frameWidth * plan.options.scale)),
      frameHeight: Math.max(1, Math.round(row.frameHeight * plan.options.scale)),
      quads: row.images.map((_, frameIndex) => {
        const placement = placements.get(placementKey(rowIndex, frameIndex));
        if (!placement) {
          throw new Error(`Missing atlas placement for ${row.label}:${frameIndex}`);
        }

        const quad = {
          x: placement.x,
          y: placement.y,
          w: placement.w,
          h: placement.h,
        };
        return multiPage ? { ...quad, page: placement.page } : quad;
      }),
    })),
  };
}
