import type { ExportFormat } from "@/types/file";
import { create } from "zustand";

interface ExportOptionsState {
  mode: ExportFormat;
  setMode: (mode: ExportFormat) => void;
  intervals: number;
  setIntervals: (interval: number) => void;
  iterations: number;
  setIterations: (iterations: number) => void;
  width: number;
  setWidth: (width: number) => void;
  height: number;
  setHeight: (height: number) => void;
}

export const useExportOptionsStore = create<ExportOptionsState>((set) => ({
  mode: "zip",
  setMode: (mode: ExportFormat) => set(() => ({ mode: mode })),
  intervals: 250,
  setIntervals: (intervals: number) => set(() => ({ intervals: intervals })),
  iterations: 10,
  setIterations: (iterations: number) =>
    set(() => ({ iterations: iterations })),
  width: 300,
  setWidth: (width: number) => set(() => ({ width: width })),
  height: 150,
  setHeight: (height: number) => set(() => ({ height: height })),
}));
