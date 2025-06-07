import type { ExportFormat } from "@/types/file";
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
  intervals: 250,
  setIntervals: (intervals: number) => set(() => ({ intervals: intervals })),
  frameDelay: 250,
  setFrameDelay: (frameDelay: number) =>
    set(() => ({ frameDelay: frameDelay })),
  iterations: 10,
  setIterations: (iterations: number) =>
    set(() => ({ iterations: iterations })),
  images: [],
  setImages: (images: string[]) => set(() => ({ images: images })),
  preview: true,
  setPreview: (preview: boolean) => set(() => ({ preview: preview })),
  width: 500,
  setWidth: (width: number) => set(() => ({ width: width })),
  height: 500,
  setHeight: (height: number) => set(() => ({ height: height })),
  exportWidth: 64,
  setExportWidth: (exportWidth: number) =>
    set(() => ({ exportWidth: exportWidth })),
  exportHeight: 64,
  setExportHeight: (exportHeight: number) =>
    set(() => ({ exportHeight: exportHeight })),
}));
