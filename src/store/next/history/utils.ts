import type { HistoryAction } from "@/types/history";
import { useTransformsStore } from "../transforms";
import { useEntitiesStore } from "../entities";
import { useMaterialsStore } from "../materials";

export const applyAction = (action: HistoryAction) => {
  switch (action.type) {
    case "transform/move":
      return useTransformsStore
        .getState()
        .setTransform(action.uuid, { position: action.to });
    case "transform/rotate":
      return useTransformsStore
        .getState()
        .setTransform(action.uuid, { rotation: action.to });
    case "transform/scale":
      return useTransformsStore
        .getState()
        .setTransform(action.uuid, { scale: action.to });
    case "entity/add":
      return useEntitiesStore.getState().restoreEntity(action.entity);
    case "entity/remove":
      return useEntitiesStore.getState().removeEntity(action.uuid);
    case "entity/children":
      return useEntitiesStore.getState().setChildren(action.uuid, action.to);
    case "entity/rename":
      return useEntitiesStore.getState().renameEntity(action.uuid, action.to);
    case "material/change":
      return useMaterialsStore.getState().setMaterial(action.uuid, action.to);
    case "visibility/set":
      return useEntitiesStore.getState().setVisibility(action.uuid, action.to);
  }
};

export const reverseAction = (action: HistoryAction) => {
  switch (action.type) {
    case "transform/move":
      return useTransformsStore
        .getState()
        .setTransform(action.uuid, { position: action.from });
    case "transform/rotate":
      return useTransformsStore
        .getState()
        .setTransform(action.uuid, { rotation: action.from });
    case "transform/scale":
      return useTransformsStore
        .getState()
        .setTransform(action.uuid, { scale: action.from });
    case "entity/add":
      return useEntitiesStore.getState().removeEntity(action.uuid);
    case "entity/remove":
      return useEntitiesStore.getState().restoreEntity(action.entity);
    case "entity/rename":
      return useEntitiesStore.getState().renameEntity(action.uuid, action.from);
    case "entity/children":
      return useEntitiesStore.getState().setChildren(action.uuid, action.from);
    case "material/change":
      return useMaterialsStore.getState().setMaterial(action.uuid, action.from);
    case "visibility/set":
      return useEntitiesStore
        .getState()
        .setVisibility(action.uuid, action.from);
  }
};
