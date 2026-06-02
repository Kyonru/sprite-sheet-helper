import { create } from "zustand";
import type { ExportFormat } from "@/types/file";
import { getBasedOnDisplaySize } from "@/utils/query";
import { inspector } from "@kyonru/zustand-inspector";
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
  cameraAngle?: number;
  exportNormalMap: boolean;
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
  setCameraAngle: (cameraAngle?: number) => void;
  setExportNormalMap: (exportNormalMap: boolean) => void;
  setEditorBackgroundColor: (editorBackgroundColor: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  setName: (name: string) => void;
  update: (settings: Partial<SettingsState>) => void;
}

const initialState: SettingsState = {
  name: "Untitled Project",
  mode: "spritesheet",
  editorBackgroundColor: "#1a1a1a",
  width: DEFAULT_DISPLAY_SIZE,
  height: DEFAULT_DISPLAY_SIZE,
  exportWidth: 64,
  exportHeight: 64,
  cameraDistance: 5,
  cameraAngle: undefined,
  exportNormalMap: false,
  theme: "dark",
  gridSectionColor: "#a09f9f",
  gridCellColor: "#868686",
};

interface SettingsStore extends SettingsState, SettingsActions {}

const WATCHED_KEYS: (keyof SettingsState)[] = [
  "mode",
  "width",
  "height",
  "exportWidth",
  "exportHeight",
  "cameraDistance",
  "cameraAngle",
  "exportNormalMap",
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
        ...initialState,

        update: (settings) => set((state) => ({ ...state, ...settings })),
        setMode: (mode) => set({ mode }),
        setWidth: (width) => set({ width }),
        setHeight: (height) => set({ height }),
        setExportWidth: (exportWidth) => set({ exportWidth }),
        setExportHeight: (exportHeight) => set({ exportHeight }),
        setCameraDistance: (cameraDistance) => set({ cameraDistance }),
        setCameraAngle: (cameraAngle) => set({ cameraAngle }),
        setExportNormalMap: (exportNormalMap) => set({ exportNormalMap }),
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
            cameraAngle: get().cameraAngle,
            exportNormalMap: get().exportNormalMap,
            editorBackgroundColor: get().editorBackgroundColor,
            gridSectionColor: get().gridSectionColor,
            gridCellColor: get().gridCellColor,
            theme: get().theme,
          };
        },

        reset: () => set(initialState),

        hydrate: (snapshot) =>
          set({
            name: snapshot.name,
            mode: snapshot.mode,
            width: snapshot.width,
            height: snapshot.height,
            exportWidth: snapshot.exportWidth,
            exportHeight: snapshot.exportHeight,
            cameraDistance: snapshot.cameraDistance,
            cameraAngle: snapshot.cameraAngle,
            exportNormalMap: snapshot.exportNormalMap ?? false,
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
    { name: "Settings", enabled: import.meta.env.DEV },
  ),
);
