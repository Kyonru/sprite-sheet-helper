import { vi } from "vitest";

const context2d = {
  drawImage: vi.fn(),
  reset: vi.fn(),
  imageSmoothingEnabled: false,
  imageSmoothingQuality: "low",
};

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(() => context2d),
});

Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
  configurable: true,
  value: vi.fn(() => "data:image/png;base64,transparent-frame"),
});
