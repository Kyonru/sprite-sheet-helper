import { create } from "zustand";
import type { AtlasLayout, AtlasOptions, ExportFormat } from "@/types/file";
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
  atlasLayout: AtlasLayout;
  atlasPadding: number;
  atlasBleed: number;
  atlasScale: number;
  maxAtlasSize: number;
  allowMultiPage: boolean;
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
  setAtlasOptions: (atlasOptions: Partial<AtlasOptions>) => void;
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
  atlasLayout: "rows",
  atlasPadding: 0,
  atlasBleed: 0,
  atlasScale: 1,
  maxAtlasSize: 2048,
  allowMultiPage: false,
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
  "atlasLayout",
  "atlasPadding",
  "atlasBleed",
  "atlasScale",
  "maxAtlasSize",
  "allowMultiPage",
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
        setAtlasOptions: (atlasOptions) =>
          set((state) => ({
            atlasLayout: atlasOptions.layout ?? state.atlasLayout,
            atlasPadding: atlasOptions.padding ?? state.atlasPadding,
            atlasBleed: atlasOptions.extrude ?? state.atlasBleed,
            atlasScale: atlasOptions.scale ?? state.atlasScale,
            maxAtlasSize: atlasOptions.maxAtlasSize ?? state.maxAtlasSize,
            allowMultiPage:
              atlasOptions.allowMultiPage ?? state.allowMultiPage,
          })),
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
            atlasLayout: get().atlasLayout,
            atlasPadding: get().atlasPadding,
            atlasBleed: get().atlasBleed,
            atlasScale: get().atlasScale,
            maxAtlasSize: get().maxAtlasSize,
            allowMultiPage: get().allowMultiPage,
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
            atlasLayout: snapshot.atlasLayout ?? "rows",
            atlasPadding: snapshot.atlasPadding ?? 0,
            atlasBleed: snapshot.atlasBleed ?? 0,
            atlasScale: snapshot.atlasScale ?? 1,
            maxAtlasSize: snapshot.maxAtlasSize ?? 2048,
            allowMultiPage: snapshot.allowMultiPage ?? false,
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
