import { create } from "zustand";
import type { ExportFormat } from "@/types/file";
import { getBasedOnDisplaySize } from "@/utils/query";
import { inspector } from "../../../devtools/inspector-middleware";

const DEFAULT_DISPLAY_SIZE = getBasedOnDisplaySize({
  xs: 64,
  sm: 128,
  md: 128,
  lg: 256,
  xl: 256,
  xxl: 256,
});

export interface SettingsState {
  mode: ExportFormat;
  width: number;
  height: number;
  exportWidth: number;
  exportHeight: number;
  cameraDistance: number;
  editorBackgroundColor: string;
  gridSectionColor: string;
  gridCellColor: string;
  theme: "light" | "dark";
}

interface SettingsActions {
  setMode: (mode: ExportFormat) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setExportWidth: (exportWidth: number) => void;
  setExportHeight: (exportHeight: number) => void;
  setCameraDistance: (cameraDistance: number) => void;
  setEditorBackgroundColor: (editorBackgroundColor: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  update: (settings: Partial<SettingsState>) => void;
}

interface SettingsStore extends SettingsState, SettingsActions {}

export const useSettingsStore = create<SettingsStore>()(
  inspector(
    (set) => ({
      mode: "spritesheet",
      editorBackgroundColor: "#1a1a1a",
      width: DEFAULT_DISPLAY_SIZE,
      height: DEFAULT_DISPLAY_SIZE,
      exportWidth: 64,
      exportHeight: 64,
      cameraDistance: 5,
      theme: "dark",
      gridSectionColor: "#a09f9f",
      gridCellColor: "#868686",

      update: (settings) => set((state) => ({ ...state, ...settings })),
      setMode: (mode) => set({ mode }),
      setWidth: (width) => set({ width }),
      setHeight: (height) => set({ height }),
      setExportWidth: (exportWidth) => set({ exportWidth }),
      setExportHeight: (exportHeight) => set({ exportHeight }),
      setCameraDistance: (cameraDistance) => set({ cameraDistance }),
      setEditorBackgroundColor: (editorBackgroundColor) =>
        set({ editorBackgroundColor }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "Settings" },
  ),
);
