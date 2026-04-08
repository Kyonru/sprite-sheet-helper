import type { HistoryAction, HistoryEntry } from "@/types/history";

type Direction = "forward" | "backward";

const runAction = (entry: HistoryEntry, dir: Direction) => {
  if (entry.type === "batch") {
    const actions =
      dir === "forward" ? entry.actions : [...entry.actions].reverse();

    for (const action of actions) {
      runAction(action, dir);
    }
    return;
  }

  const value = dir === "forward" ? entry.to : entry.from;

  entry.apply({ dir, value });
};

export const applyAction = (entry: HistoryEntry) => runAction(entry, "forward");

export const reverseAction = (entry: HistoryEntry) =>
  runAction(entry, "backward");

export const createMergeKey = (
  scope: "transform" | "target" | "entity" | "light" | "settings" | "effect",
  uuid: string,
  property?:
    | "position"
    | "rotation"
    | "scale"
    | "edit"
    | "children"
    | "name"
    | "init",
) => {
  return property ? `${scope}:${uuid}:${property}` : `${scope}:${uuid}`;
};

export const mergeKeyForAction = (
  action: HistoryAction,
): string | undefined => {
  switch (action.type) {
    case "transform/position":
      return createMergeKey("transform", action.uuid, "position");

    case "transform/rotate":
      return createMergeKey("transform", action.uuid, "rotation");

    case "transform/scale":
      return createMergeKey("transform", action.uuid, "scale");

    case "transform/edit":
      return createMergeKey("transform", action.uuid, "edit");

    default:
      return undefined;
  }
};
