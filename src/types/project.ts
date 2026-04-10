import type { CamerasState } from "@/store/next/cameras";
import type { EffectsState } from "@/store/next/effects";
import type { EntitiesState } from "@/store/next/entities";
import type { HistoryState } from "@/store/next/history";
import type { ImagesState } from "@/store/next/images";
import type { LightsState } from "@/store/next/lights";
import type { ModelsState } from "@/store/next/models";
import type { SettingsState } from "@/store/next/settings";
import type { TargetsState } from "@/store/next/targets";
import type { TransformsState } from "@/store/next/transforms";

export interface ProjectSnapshot_v1 {
  version: 1;
  name: string;
  savedAt: number;
  entities: EntitiesState;
  settings: SettingsState;
  images: ImagesState;
  lights: LightsState;
  transforms: TransformsState;
  targets: TargetsState;
  models: ModelsState;
  cameras: CamerasState;
  history: HistoryState;
  effects: EffectsState;
}

// Union type — extend as you add versions
export type ProjectSnapshotVersion = ProjectSnapshot_v1;

export const CURRENT_VERSION = 1;
