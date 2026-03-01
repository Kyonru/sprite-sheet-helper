import type { Entity, MaterialComponent } from "@/types/ecs";

type Vec3 = [number, number, number];

// Transforms
type MoveAction = {
  type: "transform/move";
  uuid: string;
  from: Vec3;
  to: Vec3;
};
type RotateAction = {
  type: "transform/rotate";
  uuid: string;
  from: Vec3;
  to: Vec3;
};
type ScaleAction = {
  type: "transform/scale";
  uuid: string;
  from: Vec3;
  to: Vec3;
};

// Entity
type AddEntityAction = { type: "entity/add"; uuid: string; entity: Entity };
type RemoveEntityAction = {
  type: "entity/remove";
  uuid: string;
  entity: Entity;
};
type RenameAction = {
  type: "entity/rename";
  uuid: string;
  from: string;
  to: string;
};
type ChildrenAction = {
  type: "entity/children";
  uuid: string;
  from: string[];
  to: string[];
};

// Material
type MaterialChangeAction = {
  type: "material/change";
  uuid: string;
  from: Partial<MaterialComponent>;
  to: Partial<MaterialComponent>;
};

// Visibility
type VisibilityAction = {
  type: "visibility/set";
  uuid: string;
  from: boolean;
  to: boolean;
};

export type HistoryAction =
  | MoveAction
  | RotateAction
  | ScaleAction
  | AddEntityAction
  | RemoveEntityAction
  | RenameAction
  | MaterialChangeAction
  | VisibilityAction
  | ChildrenAction;
