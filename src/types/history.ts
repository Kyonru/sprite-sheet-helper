import type { Transform as TransformMode } from "@/types/transform";
import type {
  CameraComponent,
  CameraType,
  Entity,
  LightComponent,
} from "./ecs";
import type { EffectComponent } from "./effects";

export type Vec3 = [number, number, number];

type Action<TType extends string, TFrom, TTo> = {
  type: TType;
  uuid: string;
  from: TFrom;
  to: TTo;

  apply: (
    input: { dir: "forward"; value: TTo } | { dir: "backward"; value: TFrom },
  ) => void;
};

// Transforms
export type TransformInitAction = Action<
  "transform/init",
  null,
  {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
  }
>;
export type TransformRemoveAction = Action<
  "transform/remove",
  {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
  },
  null
>;
export type PositionAction = Action<"transform/position", Vec3, Vec3>;
export type RotateAction = Action<"transform/rotate", Vec3, Vec3>;
export type ScaleAction = Action<"transform/scale", Vec3, Vec3>;
export type TransformModeAction = Action<
  "transform/mode",
  TransformMode,
  TransformMode
>;
export type TransformEditAction = Action<
  "transform/edit",
  {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
  },
  {
    position: Vec3;
    rotation: Vec3;
    scale: Vec3;
  }
>;
type TransformAction =
  | TransformInitAction
  | TransformEditAction
  | PositionAction
  | RotateAction
  | ScaleAction
  | TransformRemoveAction
  | TransformModeAction;

// Targets
type TargetInitAction = Action<"target/init", null, Vec3>;
type TargetRemoveAction = Action<"target/remove", Vec3, null>;
type TargetPositionAction = Action<"target/position", Vec3, Vec3>;

type TargetAction =
  | TargetInitAction
  | TargetRemoveAction
  | TargetPositionAction;

// Entity
type AddEntityAction = Action<"entity/add", null, Entity>;
type RemoveEntityAction = Action<"entity/remove", Entity, null>;
type RenameAction = Action<"entity/rename", string, string>;
type ChildrenAction = Action<"entity/children", string[], string[]>;

type EntityAction =
  | AddEntityAction
  | RemoveEntityAction
  | RenameAction
  | ChildrenAction;

// Settings
type SettingsChange = Action<
  "settings/change",
  string | number,
  string | number
>;

// Lights
type LightInitAction = Action<"light/init", null, LightComponent>;
type LightRemoveAction = Action<"light/remove", LightComponent, null>;
type LightEditAction = Action<"light/edit", LightComponent, LightComponent>;

type LightAction = LightInitAction | LightRemoveAction | LightEditAction;

// Effects
type EffectChangeAction = Action<"effect/init", null, EffectComponent>;
type EffectInitAction = Action<"effect/edit", EffectComponent, EffectComponent>;
type EffectRemoveAction = Action<"effect/remove", EffectComponent, null>;

type EffectAction = EffectRemoveAction | EffectInitAction | EffectChangeAction;

type CameraRemoveAction = Action<"camera/remove", CameraComponent, null>;
type CameraTypeAction = Action<"camera/type", CameraType, CameraType>;
type CameraEditAction = Action<"camera/edit", CameraComponent, CameraComponent>;
type CameraActiveAction = Action<"camera/active", string, string>;

type CameraAction =
  | CameraRemoveAction
  | CameraTypeAction
  | CameraEditAction
  | CameraActiveAction;

export type HistoryAction =
  | TransformAction
  | TargetAction
  | EntityAction
  | SettingsChange
  | LightAction
  | EffectAction
  | CameraAction;

export type HistoryBatch = {
  type: "batch";
  label?: string;
  actions: HistoryAction[];
};

export type MergeMeta = {
  mergeKey?: string;
  timestamp?: number;
};

export type HistoryEntry =
  | (HistoryAction & MergeMeta)
  | (HistoryBatch & MergeMeta);

export type ActionOf<T extends HistoryAction["type"]> = Extract<
  HistoryAction,
  { type: T }
>;

export type HistoryTransaction = {
  label?: string;
  mergeKey?: string;
  actions: HistoryAction[];
};
