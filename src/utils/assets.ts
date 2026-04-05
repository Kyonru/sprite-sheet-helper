import type { ExportRow } from "@/store/next/images";
import GIF from "gif.js.optimized";
import { toast } from "sonner";

export interface SpritesheetOptions {
  spacing: number; // px between frames
  margin: number; // px around sheet border
  format: "image/png" | "image/webp";
  quality: number;
}

const DEFAULT_OPTIONS: SpritesheetOptions = {
  spacing: 0,
  margin: 0,
  format: "image/png",
  quality: 1.0,
};

export async function createSpriteSheet(
  rows: ExportRow[],
  options: Partial<SpritesheetOptions> = {},
): Promise<string> {
  if (rows.length === 0) throw new Error("No rows to export");

  const { spacing, margin, format, quality } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const allLoaded = await Promise.all(
    rows.map((row) =>
      Promise.all(
        row.images.map(
          (src) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error("Failed to load frame"));
              img.src = "data:image/png;base64," + src;
            }),
        ),
      ),
    ),
  );

  const totalWidth =
    margin * 2 +
    Math.max(
      ...rows.map(
        (row) =>
          row.images.length * row.frameWidth +
          (row.images.length - 1) * spacing,
      ),
    );

  const totalHeight =
    margin * 2 +
    rows.reduce((acc, row) => acc + row.frameHeight, 0) +
    (rows.length - 1) * spacing;

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  let yOffset = margin;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const loaded = allLoaded[rowIndex];

    for (let col = 0; col < loaded.length; col++) {
      const x = margin + col * (row.frameWidth + spacing);
      ctx.drawImage(loaded[col], x, yOffset, row.frameWidth, row.frameHeight);
    }

    yOffset += row.frameHeight + spacing;
  }

  for (const rowImages of allLoaded) {
    for (const img of rowImages) {
      img.src = "";
    }
  }

  return canvas.toDataURL(format, quality);
}

export async function createGif(
  images: string[],
  width: number,
  height: number,
  delay: number,
  quality: number = 0,
  repeat: number = 0,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const gif = new GIF({
      repeat,
      workers: 2,
      quality,
      width,
      height,
      transparent: 0x00000000,
      workerScript: "/gif.worker.js", // Make sure this is served from `public/`
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = "high";
    ctx.imageSmoothingEnabled = false;
    if (!ctx) return reject("Canvas context not available");

    let loaded = 0;

    images.forEach((src, index) => {
      const img = new Image();
      img.onload = () => {
        ctx.reset();
        ctx.drawImage(img, 0, 0, width, height);
        gif.addFrame(ctx, {
          delay,
          copy: true,
        });

        loaded++;
        if (loaded === images.length) {
          gif.on("finished", (blob: Blob) => {
            const url = URL.createObjectURL(blob);
            resolve(url);
          });
          gif.render();
        }
      };
      img.onerror = () => {
        reject(`Failed to load image at index ${index}`);
      };

      // Ensure it's a valid data URL
      img.src = src.startsWith("data:image")
        ? src
        : `data:image/png;base64,${src}`;
    });
  });
}

export interface SpritesheetJSON {
  meta: {
    version: string;
    exportedAt: string;
    imageWidth: number;
    imageHeight: number;
    frameCount: number;
    animationCount: number;
    spacing: number;
    margin: number;
  };
  animations: {
    name: string;
    frames: number;
    fps: number;
    frameWidth: number;
    frameHeight: number;
    quads: { x: number; y: number; w: number; h: number }[];
  }[];
}

export const createSpritesheetJSON = (
  rows: ExportRow[],
  options: Partial<SpritesheetOptions> = {},
): SpritesheetJSON => {
  const { spacing, margin } = { ...DEFAULT_OPTIONS, ...options };

  const totalWidth =
    margin * 2 +
    Math.max(
      ...rows.map(
        (row) =>
          row.images.length * row.frameWidth +
          (row.images.length - 1) * spacing,
      ),
    );

  const totalHeight =
    margin * 2 +
    rows.reduce((acc, row) => acc + row.frameHeight, 0) +
    (rows.length - 1) * spacing;

  let yOffset = margin;

  return {
    meta: {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      imageWidth: totalWidth,
      imageHeight: totalHeight,
      frameCount: rows.reduce((acc, row) => acc + row.images.length, 0),
      animationCount: rows.length,
      spacing,
      margin,
    },
    animations: rows.map((row) => {
      const animation = {
        name: row.label,
        frames: row.images.length,
        fps: row.fps ?? 12,
        frameWidth: row.frameWidth,
        frameHeight: row.frameHeight,
        quads: row.images.map((_, frameIndex) => ({
          x: margin + frameIndex * (row.frameWidth + spacing),
          y: yOffset,
          w: row.frameWidth,
          h: row.frameHeight,
        })),
      };

      yOffset += row.frameHeight + spacing;

      return animation;
    }),
  };
};

export const downloadFile = (href: string, name: string) => {
  const a = document.createElement("a");
  a.target = "_blank";
  a.href = href;
  a.download = name;
  a.click();
};

export const importFile = (accepts: string[], onFile: (file: File) => void) => {
  const allowedExtensions = accepts
    .map((type) => `.${type}`)
    .map((s) => s.trim().toLowerCase());

  const input = document.createElement("input");
  input.type = "file";
  input.accept = allowedExtensions.join(",");
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (!allowedExtensions.includes(ext)) {
      toast.error(
        `File type not supported. Accepted: ${allowedExtensions.join(", ")}`,
      );
      return;
    }

    onFile(file);
  };
  setTimeout(() => input.click(), 0);
};
