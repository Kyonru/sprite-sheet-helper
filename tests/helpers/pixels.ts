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
