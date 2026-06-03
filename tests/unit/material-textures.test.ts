import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateRetroTextureVariant } from "@/utils/material-textures";

describe("material texture helpers", () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 2;
      naturalHeight = 2;
      set src(_: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: MockImage,
    });

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        drawImage: vi.fn(),
        clearRect: vi.fn(),
        putImageData: vi.fn(),
        imageSmoothingEnabled: false,
        getImageData: vi.fn(() => ({
          width: 2,
          height: 2,
          data: new Uint8ClampedArray([
            10, 20, 30, 255,
            80, 90, 100, 255,
            120, 130, 140, 255,
            250, 240, 230, 255,
          ]),
        })),
      })),
    });

    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: vi.fn((callback: BlobCallback) =>
        callback(new Blob(["png"], { type: "image/png" })),
      ),
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: originalImage,
    });
  });

  it("generates a PNG retro variant through canvas", async () => {
    const blob = await generateRetroTextureVariant(
      "data:image/png;base64,source",
      {
        targetSize: 2,
        paletteColors: 4,
        dither: true,
        nearest: true,
      },
    );

    expect(blob.type).toBe("image/png");
  });
});
