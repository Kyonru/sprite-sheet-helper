import type { CamerasState } from "@/store/next/cameras";
import type { EffectsState } from "@/store/next/effects";
import type { EntitiesState } from "@/store/next/entities";
import type { HistoryState } from "@/store/next/history";
import type { ImagesState } from "@/store/next/images";
import type { LightsState } from "@/store/next/lights";
import type { ModelDowngradesState } from "@/types/model-downgrade";
import type { ModelsState } from "@/store/next/models";
import type { SettingsState } from "@/store/next/settings";
import type { TargetsState } from "@/store/next/targets";
import type { TransformsState } from "@/store/next/transforms";
import type { MaterialsSnapshot } from "./materials";
import type { AuthoredModelsState } from "./authored-models";
import type { SpritePostprocessSnapshot } from "./sprite-postprocess";

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

export interface ProjectSnapshot_v2 extends Omit<ProjectSnapshot_v1, "version"> {
  version: 2;
  materials: MaterialsSnapshot;
}

export interface ProjectSnapshot_v3 extends Omit<ProjectSnapshot_v2, "version"> {
  version: 3;
  modelDowngrades: ModelDowngradesState;
}

export interface ProjectSnapshot_v4 extends Omit<ProjectSnapshot_v3, "version"> {
  version: 4;
  authoredModels: AuthoredModelsState;
}

export interface ProjectSnapshot_v5 extends Omit<ProjectSnapshot_v4, "version"> {
  version: 5;
}

export interface ProjectSnapshot_v6 extends Omit<ProjectSnapshot_v5, "version"> {
  version: 6;
  spritePostprocess: SpritePostprocessSnapshot;
}

export interface ProjectSnapshot_v7 extends Omit<ProjectSnapshot_v6, "version"> {
  version: 7;
}

export interface ProjectSnapshot_v8 extends Omit<ProjectSnapshot_v7, "version"> {
  version: 8;
}

export type ProjectSnapshot = ProjectSnapshot_v8;

// Union type — extend as you add versions
export type ProjectSnapshotVersion =
  | ProjectSnapshot_v1
  | ProjectSnapshot_v2
  | ProjectSnapshot_v3
  | ProjectSnapshot_v4
  | ProjectSnapshot_v5
  | ProjectSnapshot_v6
  | ProjectSnapshot_v7
  | ProjectSnapshot_v8;

export const CURRENT_VERSION = 8;

export const RECOVERY_SNAPSHOT_VERSION = 1;

export type RecoveryRuntimeMeta = {
  source?: string;
  url?: string;
  userAgent?: string;
};

export interface ProjectRecoveryEnvelope {
  version: number;
  appVersion: string;
  savedAt: number;
  projectSnapshot: ProjectSnapshotVersion;
  runtimeMeta?: RecoveryRuntimeMeta;
}
