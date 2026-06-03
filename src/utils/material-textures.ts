import type { RetroTextureOptions } from "@/types/materials";

export type TextureDimensions = {
  width: number;
  height: number;
};

export async function getImageFileDimensions(
  file: File,
): Promise<TextureDimensions | undefined> {
  if (!file.type.startsWith("image/")) return undefined;

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function generateRetroTextureVariant(
  source: File | Blob | string,
  options: RetroTextureOptions,
): Promise<Blob> {
  const sourceUrl =
    typeof source === "string" ? source : URL.createObjectURL(source);

  try {
    const image = await loadImage(sourceUrl);
    const size = Math.max(1, Math.floor(options.targetSize));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas context is unavailable");

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    quantizeImageData(imageData, options.paletteColors, options.dither);
    ctx.putImageData(imageData, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate texture variant"));
      }, "image/png");
    });
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load texture image"));
    image.src = src;
  });
}

function quantizeImageData(
  imageData: ImageData,
  paletteColors: number,
  dither: boolean,
) {
  const data = imageData.data;
  const width = imageData.width;
  const colorCount = Math.max(2, Math.min(256, Math.floor(paletteColors)));
  const levels = Math.max(2, Math.round(Math.cbrt(colorCount)));
  const step = 255 / (levels - 1);

  for (let y = 0; y < imageData.height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const threshold = dither ? (bayer4(x, y) - 0.5) * step : 0;
      data[i] = clampChannel(Math.round((data[i] + threshold) / step) * step);
      data[i + 1] = clampChannel(
        Math.round((data[i + 1] + threshold) / step) * step,
      );
      data[i + 2] = clampChannel(
        Math.round((data[i + 2] + threshold) / step) * step,
      );
    }
  }
}

function bayer4(x: number, y: number) {
  const matrix = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ];
  return matrix[(y % 4) * 4 + (x % 4)] / 15;
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, value));
}
