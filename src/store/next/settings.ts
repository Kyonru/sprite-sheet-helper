import { create } from "zustand";
import type { ExportFormat } from "@/types/file";
import { getBasedOnDisplaySize } from "@/utils/query";
import { inspector } from "../../../devtools/inspector-middleware";

const DEFAULT_DISPLAY_SIZE = getBasedOnDisplaySize({
  xs: 64,
  sm: 128,
  md: 256,
  lg: 512,
  xl: 1024,
  xxl: 1024,
});

export interface SettingsState {
  mode: ExportFormat;
  width: number;
  height: number;
  exportWidth: number;
  exportHeight: number;
  cameraDistance: number;
}

interface SettingsActions {
  setMode: (mode: ExportFormat) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setExportWidth: (exportWidth: number) => void;
  setExportHeight: (exportHeight: number) => void;
  setCameraDistance: (cameraDistance: number) => void;
  update: (settings: Partial<SettingsState>) => void;
}

interface SettingsStore extends SettingsState, SettingsActions {}

export const useSettingsStore = create<SettingsStore>()(
  inspector(
    (set) => ({
      mode: "spritesheet",
      width: DEFAULT_DISPLAY_SIZE,
      height: DEFAULT_DISPLAY_SIZE,
      exportWidth: 64,
      exportHeight: 64,
      cameraDistance: 5,
      update: (settings) => set((state) => ({ ...state, ...settings })),
      setMode: (mode) => set({ mode }),
      setWidth: (width) => set({ width }),
      setHeight: (height) => set({ height }),
      setExportWidth: (exportWidth) => set({ exportWidth }),
      setExportHeight: (exportHeight) => set({ exportHeight }),
      setCameraDistance: (cameraDistance) => set({ cameraDistance }),
    }),
    { name: "Settings" },
  ),
);
