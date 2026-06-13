import type { ExportRow } from "@/types/file";
import type {
  ColorAdjustEffect,
  DropShadowEffect,
  GlowEffect,
  OuterOutlineEffect,
  SpritePostprocessEffect,
  SpritePostprocessSnapshot,
} from "@/types/sprite-postprocess";

type Rgba = {
  r: number;
  g: number;
  b: number;
};

type LoadedFrame = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

function asDataUrl(src: string): string {
  return src.startsWith("data:") ? src : `data:image/png;base64,${src}`;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function parseColor(color: string): Rgba {
  const normalized = color.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => part + part)
          .join("")
      : hex.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load sprite frame."));
    image.src = asDataUrl(src);
  });
}

async function loadFrame(src: string): Promise<LoadedFrame> {
  const image = await loadImage(src);
  const canvas = createCanvas(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);
  return {
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

function clamp255(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function blendPixel(
  output: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  color: Rgba,
  alpha: number,
) {
  if (x < 0 || y < 0 || x >= width) return;
  const index = (y * width + x) * 4;
  if (index < 0 || index + 3 >= output.length) return;
  const srcAlpha = clamp01(alpha);
  if (srcAlpha <= 0) return;
  const dstAlpha = output[index + 3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outAlpha <= 0) return;
  output[index] = clamp255(
    (color.r * srcAlpha + output[index] * dstAlpha * (1 - srcAlpha)) /
      outAlpha,
  );
  output[index + 1] = clamp255(
    (color.g * srcAlpha + output[index + 1] * dstAlpha * (1 - srcAlpha)) /
      outAlpha,
  );
  output[index + 2] = clamp255(
    (color.b * srcAlpha + output[index + 2] * dstAlpha * (1 - srcAlpha)) /
      outAlpha,
  );
  output[index + 3] = clamp255(outAlpha * 255);
}

function sourceAlpha(frame: LoadedFrame, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return 0;
  return frame.data[(y * frame.width + x) * 4 + 3] / 255;
}

function hasSourceAlpha(frame: LoadedFrame, x: number, y: number): boolean {
  return sourceAlpha(frame, x, y) > 0.02;
}

function forEachOpaqueSourcePixel(
  frame: LoadedFrame,
  callback: (x: number, y: number, alpha: number) => void,
) {
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const alpha = sourceAlpha(frame, x, y);
      if (alpha > 0.02) callback(x, y, alpha);
    }
  }
}

function applyOuterOutline(
  output: Uint8ClampedArray,
  outputWidth: number,
  frame: LoadedFrame,
  padding: number,
  effect: OuterOutlineEffect,
) {
  const radius = Math.max(0, Math.ceil(effect.thickness));
  if (radius <= 0) return;
  const color = parseColor(effect.color);
  const opacity = clamp01(effect.opacity);
  const crisp = effect.outlineMode === "crisp";

  forEachOpaqueSourcePixel(frame, (x, y, alpha) => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const distance = crisp
          ? Math.max(Math.abs(dx), Math.abs(dy))
          : Math.hypot(dx, dy);
        if (distance > radius || distance === 0) continue;
        const localX = x + dx;
        const localY = y + dy;
        if (hasSourceAlpha(frame, localX, localY)) continue;
        const falloff = crisp ? 1 : 1 - distance / (radius + 1);
        blendPixel(
          output,
          outputWidth,
          padding + localX,
          padding + localY,
          color,
          opacity * alpha * (crisp ? 1 : Math.max(0.35, falloff)),
        );
      }
    }
  });
}

function applyDropShadow(
  output: Uint8ClampedArray,
  outputWidth: number,
  frame: LoadedFrame,
  padding: number,
  effect: DropShadowEffect,
) {
  const spread = Math.max(0, Math.ceil(effect.spread));
  const blur = Math.max(0, Math.ceil(effect.blur));
  const radius = spread + blur;
  const color = parseColor(effect.color);
  const opacity = clamp01(effect.opacity);
  const offsetX = Math.round(effect.offsetX);
  const offsetY = Math.round(effect.offsetY);

  forEachOpaqueSourcePixel(frame, (x, y, alpha) => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const falloff =
          blur <= 0 || distance <= spread
            ? 1
            : 1 - (distance - spread) / Math.max(1, blur);
        blendPixel(
          output,
          outputWidth,
          padding + x + offsetX + dx,
          padding + y + offsetY + dy,
          color,
          opacity * alpha * clamp01(falloff),
        );
      }
    }
  });
}

function applyGlow(
  output: Uint8ClampedArray,
  outputWidth: number,
  frame: LoadedFrame,
  padding: number,
  effect: GlowEffect,
) {
  const radius = Math.max(0, Math.ceil(effect.radius));
  if (radius <= 0) return;
  const color = parseColor(effect.color);
  const opacity = clamp01(effect.opacity);

  forEachOpaqueSourcePixel(frame, (x, y, alpha) => {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const distance = Math.hypot(dx, dy);
        if (distance > radius || distance === 0) continue;
        const falloff = 1 - distance / radius;
        blendPixel(
          output,
          outputWidth,
          padding + x + dx,
          padding + y + dy,
          color,
          opacity * alpha * clamp01(falloff),
        );
      }
    }
  });
}

function drawOriginal(
  output: Uint8ClampedArray,
  outputWidth: number,
  frame: LoadedFrame,
  padding: number,
) {
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const sourceIndex = (y * frame.width + x) * 4;
      const alpha = frame.data[sourceIndex + 3] / 255;
      if (alpha <= 0) continue;
      blendPixel(
        output,
        outputWidth,
        padding + x,
        padding + y,
        {
          r: frame.data[sourceIndex],
          g: frame.data[sourceIndex + 1],
          b: frame.data[sourceIndex + 2],
        },
        alpha,
      );
    }
  }
}

function applyColorAdjust(
  output: Uint8ClampedArray,
  effect: ColorAdjustEffect,
) {
  const brightness = Math.max(-100, Math.min(100, effect.brightness)) * 2.55;
  const contrastValue =
    Math.max(-100, Math.min(100, effect.contrast)) * 2.55;
  const contrast =
    (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
  const saturation = 1 + Math.max(-100, Math.min(100, effect.saturation)) / 100;

  for (let index = 0; index < output.length; index += 4) {
    if (output[index + 3] === 0) continue;
    let r = contrast * (output[index] - 128) + 128 + brightness;
    let g = contrast * (output[index + 1] - 128) + 128 + brightness;
    let b = contrast * (output[index + 2] - 128) + 128 + brightness;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luminance + (r - luminance) * saturation;
    g = luminance + (g - luminance) * saturation;
    b = luminance + (b - luminance) * saturation;
    output[index] = clamp255(r);
    output[index + 1] = clamp255(g);
    output[index + 2] = clamp255(b);
  }
}

function getRequiredPadding(effects: SpritePostprocessEffect[]): number {
  return effects.reduce((padding, effect) => {
    if (!effect.enabled) return padding;
    switch (effect.type) {
      case "outerOutline":
        return Math.max(padding, Math.ceil(effect.thickness));
      case "dropShadow":
        return Math.max(
          padding,
          Math.ceil(
            Math.max(Math.abs(effect.offsetX), Math.abs(effect.offsetY)) +
              effect.spread +
              effect.blur,
          ),
        );
      case "glow":
        return Math.max(padding, Math.ceil(effect.radius));
      case "colorAdjust":
        return padding;
    }
  }, 0);
}

async function processColorFrame(
  src: string,
  effects: SpritePostprocessEffect[],
  padding: number,
): Promise<string> {
  const frame = await loadFrame(src);
  const width = frame.width + padding * 2;
  const height = frame.height + padding * 2;
  const output = new Uint8ClampedArray(width * height * 4);

  for (const effect of effects) {
    if (!effect.enabled) continue;
    if (effect.type === "dropShadow") {
      applyDropShadow(output, width, frame, padding, effect);
    }
    if (effect.type === "glow") {
      applyGlow(output, width, frame, padding, effect);
    }
    if (effect.type === "outerOutline") {
      applyOuterOutline(output, width, frame, padding, effect);
    }
  }

  drawOriginal(output, width, frame, padding);

  for (const effect of effects) {
    if (effect.enabled && effect.type === "colorAdjust") {
      applyColorAdjust(output, effect);
    }
  }

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  context.putImageData(new ImageData(output, width, height), 0, 0);
  return canvas.toDataURL("image/png");
}

async function padFrame(src: string, width: number, height: number, padding: number) {
  const image = await loadImage(src);
  const canvas = createCanvas(width + padding * 2, height + padding * 2);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");
  context.imageSmoothingEnabled = false;
  context.drawImage(image, padding, padding, width, height);
  return canvas.toDataURL("image/png");
}

export async function applySpritePostprocessRows(
  rows: ExportRow[],
  settings?: SpritePostprocessSnapshot,
): Promise<ExportRow[]> {
  const effects = settings?.enabled
    ? (settings.effects ?? []).filter((effect) => effect.enabled)
    : [];
  if (effects.length === 0) return rows;

  const padding = getRequiredPadding(effects);

  return Promise.all(
    rows.map(async (row) => {
      const images = await Promise.all(
        row.images.map((image) => processColorFrame(image, effects, padding)),
      );
      const normalImages = row.normalImages
        ? await Promise.all(
            row.normalImages.map((image) =>
              padding > 0
                ? padFrame(image, row.frameWidth, row.frameHeight, padding)
                : Promise.resolve(image),
            ),
          )
        : undefined;

      return {
        ...row,
        images,
        normalImages,
        frameWidth: row.frameWidth + padding * 2,
        frameHeight: row.frameHeight + padding * 2,
      };
    }),
  );
}

export function getSpritePostprocessPadding(
  settings?: SpritePostprocessSnapshot,
): number {
  return settings?.enabled ? getRequiredPadding(settings.effects ?? []) : 0;
}
