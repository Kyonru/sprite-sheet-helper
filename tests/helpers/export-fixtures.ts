import type { ExportRow } from "@/types/file";

export const frame = (name: string): string =>
  Buffer.from(name, "utf8").toString("base64");

export const exportRow = (
  label: string,
  images: string[],
  normalImages?: string[],
  overrides: Partial<ExportRow> = {},
): ExportRow => ({
  uuid: `${label}-uuid`,
  label,
  images,
  normalImages,
  frameWidth: 16,
  frameHeight: 12,
  fps: 8,
  ...overrides,
});
