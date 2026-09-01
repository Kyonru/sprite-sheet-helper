import { readFile } from "fs/promises";
import { PNG } from "pngjs";

const CHANNELS = ["r", "g", "b", "a"] as const;

export type PixelComparisonContext = {
  workflow: string;
  image: string;
};

type DecodedPng = {
  width: number;
  height: number;
  data: Buffer;
};

async function decodePng(path: string): Promise<DecodedPng> {
  return PNG.sync.read(await readFile(path));
}

export type FrameRect = { x: number; y: number; w: number; h: number };

/**
 * The pixels of each frame rect, as one buffer per frame.
 *
 * Frames that hold the same pose produce byte-identical buffers, which is how a
 * capture that ran past the end of its clip — or sampled the same pose twice —
 * shows up in an exported atlas.
 */
export async function readAtlasFrames(
  path: string,
  rects: FrameRect[],
): Promise<Buffer[]> {
  const png = await decodePng(path);

  return rects.map((rect) => {
    const frame = Buffer.alloc(rect.w * rect.h * 4);
    for (let row = 0; row < rect.h; row += 1) {
      const from = ((rect.y + row) * png.width + rect.x) * 4;
      png.data.copy(frame, row * rect.w * 4, from, from + rect.w * 4);
    }
    return frame;
  });
}

/** Indices of frames identical to the frame before them. */
export function findRepeatedFrames(frames: Buffer[]): number[] {
  return frames
    .map((frame, index) =>
      index > 0 && frame.equals(frames[index - 1]) ? index : -1,
    )
    .filter((index) => index >= 0);
}

export async function expectExactPngPixels(
  expectedPath: string,
  actualPath: string,
  context: PixelComparisonContext,
): Promise<void> {
  const expected = await decodePng(expectedPath);
  const actual = await decodePng(actualPath);
  const prefix = `[${context.workflow}] ${context.image}`;

  if (expected.width !== actual.width || expected.height !== actual.height) {
    throw new Error(
      `${prefix} dimensions differ: expected ${expected.width}x${expected.height}, got ${actual.width}x${actual.height}`,
    );
  }

  if (expected.data.length !== actual.data.length) {
    throw new Error(
      `${prefix} RGBA buffer length differs: expected ${expected.data.length}, got ${actual.data.length}`,
    );
  }

  for (let i = 0; i < expected.data.length; i += 1) {
    if (expected.data[i] === actual.data[i]) continue;

    const pixelIndex = Math.floor(i / 4);
    const x = pixelIndex % expected.width;
    const y = Math.floor(pixelIndex / expected.width);
    const channel = CHANNELS[i % 4];

    throw new Error(
      `${prefix} pixel mismatch at (${x}, ${y}) channel ${channel}: expected ${expected.data[i]}, got ${actual.data[i]}`,
    );
  }
}
