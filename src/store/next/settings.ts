import { create } from "zustand";
import type { ExportFormat } from "@/types/file";
import { getBasedOnDisplaySize } from "@/utils/query";
import { inspector } from "../../../devtools/inspector-middleware";
import type { SnapshotEnabledStore } from "@/types/ecs";
import { withHistory } from "../common/middlewares/history";
import { createMergeKey } from "./history/utils";

const DEFAULT_DISPLAY_SIZE = getBasedOnDisplaySize({
  xs: 64,
  sm: 128,
  md: 128,
  lg: 256,
  xl: 256,
  xxl: 256,
});

export interface SettingsState {
  name: string;
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

interface SettingsActions extends SnapshotEnabledStore<SettingsState> {
  setMode: (mode: ExportFormat) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setExportWidth: (exportWidth: number) => void;
  setExportHeight: (exportHeight: number) => void;
  setCameraDistance: (cameraDistance: number) => void;
  setEditorBackgroundColor: (editorBackgroundColor: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setName: (name: string) => void;
  update: (settings: Partial<SettingsState>) => void;
}

interface SettingsStore extends SettingsState, SettingsActions {}

const WATCHED_KEYS: (keyof SettingsState)[] = [
  "mode",
  "width",
  "height",
  "exportWidth",
  "exportHeight",
  "cameraDistance",
  "editorBackgroundColor",
  "gridSectionColor",
  "gridCellColor",
  "theme",
  "name",
];

export const useSettingsStore = create<SettingsStore>()(
  inspector(
    withHistory(
      (set, get) => ({
        name: "Untitled Project",
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
        setName: (name) => set({ name }),

        getSnapshot: () => {
          return {
            name: get().name,
            mode: get().mode,
            width: get().width,
            height: get().height,
            exportWidth: get().exportWidth,
            exportHeight: get().exportHeight,
            cameraDistance: get().cameraDistance,
            editorBackgroundColor: get().editorBackgroundColor,
            gridSectionColor: get().gridSectionColor,
            gridCellColor: get().gridCellColor,
            theme: get().theme,
          };
        },

        hydrate: (snapshot) =>
          set({
            name: snapshot.name,
            mode: snapshot.mode,
            width: snapshot.width,
            height: snapshot.height,
            exportWidth: snapshot.exportWidth,
            exportHeight: snapshot.exportHeight,
            cameraDistance: snapshot.cameraDistance,
            editorBackgroundColor: snapshot.editorBackgroundColor,
            gridSectionColor: snapshot.gridSectionColor,
            gridCellColor: snapshot.gridCellColor,
            theme: snapshot.theme,
          }),
      }),
      {
        name: "Settings",
        watchers: WATCHED_KEYS.map((key) => ({
          select: (state) => state[key],
          toAction: (prev, next, api) => ({
            type: "settings/change",
            uuid: key,
            from: prev[key],
            to: next[key],
            apply: ({ value }) => {
              api.getState().update({ [key]: value });
            },
          }),
          mergeKey: () => createMergeKey("settings", key),
        })),
      },
    ),
    { name: "Settings" },
  ),
);
