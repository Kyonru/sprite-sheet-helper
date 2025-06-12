import type { ExportFormat } from "@/types/file";
import { getBasedOnDisplaySize } from "@/utils/query";
import { create } from "zustand";

interface ExportOptionsState {
  mode: ExportFormat;
  setMode: (mode: ExportFormat) => void;
  intervals: number;
  setIntervals: (interval: number) => void;
  iterations: number;
  setIterations: (iterations: number) => void;
  frameDelay: number;
  setFrameDelay: (frameDelay: number) => void;
  width: number;
  setWidth: (width: number) => void;
  height: number;
  setHeight: (height: number) => void;
  exportWidth: number;
  setExportWidth: (exportWidth: number) => void;
  exportHeight: number;
  setExportHeight: (exportHeight: number) => void;
  preview: boolean;
  setPreview: (preview: boolean) => void;
  images: string[];
  setImages: (images: string[]) => void;
}

export const useExportOptionsStore = create<ExportOptionsState>((set) => ({
  mode: "spritesheet",
  setMode: (mode: ExportFormat) => set(() => ({ mode: mode })),
  intervals: 100,
  setIntervals: (intervals: number) => set(() => ({ intervals: intervals })),
  frameDelay: 100,
  setFrameDelay: (frameDelay: number) =>
    set(() => ({ frameDelay: frameDelay })),
  iterations: 10,
  setIterations: (iterations: number) =>
    set(() => ({ iterations: iterations })),
  images: [],
  setImages: (images: string[]) => set(() => ({ images: images })),
  preview: false,
  setPreview: (preview: boolean) => set(() => ({ preview: preview })),
  width: getBasedOnDisplaySize({
    xs: 64,
    sm: 128,
    md: 256,
    lg: 512,
    xl: 1024,
    xxl: 1024,
  }),
  setWidth: (width: number) => set(() => ({ width: width })),
  height: getBasedOnDisplaySize({
    xs: 64,
    sm: 128,
    md: 256,
    lg: 512,
    xl: 1024,
    xxl: 1024,
  }),
  setHeight: (height: number) => set(() => ({ height: height })),
  exportWidth: 64,
  setExportWidth: (exportWidth: number) =>
    set(() => ({ exportWidth: exportWidth })),
  exportHeight: 64,
  setExportHeight: (exportHeight: number) =>
    set(() => ({ exportHeight: exportHeight })),
}));
