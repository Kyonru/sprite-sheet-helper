import { useCallback, useEffect } from "react";
import { initShortcuts, unregisterAllShortcuts } from "@/lib/shortcut-registry";
import {
  EventType,
  PubSub,
  ShortCutEventType,
  type ShortCutEventPayload,
} from "@/lib/events";
import { useProjectStore } from "@/store/next/project";
import { useAddModel } from "./use-add-model";
import { importFile } from "@/utils/assets";
import { ACCEPTED_MODEL_FILE_TYPES, PROJECT_FILE_TYPE } from "@/constants/file";
import { openSettings } from "@/components/panels/top/settings";
import { useHistoryStore } from "@/store/next/history";
import { useEntitiesStore } from "@/store/next/entities";
import { useEffectsStore } from "@/store/next/effects";

export const useKeyboardShortcuts = () => {
  const projectStore = useProjectStore();
  const loadFromFile = useAddModel(true);

  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);
  const setSelected = useEntitiesStore((state) => state.selectEntity);
  const setSelectedEffect = useEffectsStore((state) => state.setSelected);

  const resetSelection = useCallback(() => {
    setSelected(undefined);
    setSelectedEffect(undefined);
  }, [setSelected, setSelectedEffect]);

  const onUndo = useCallback(() => {
    resetSelection();
    undo();
  }, [resetSelection, undo]);

  const onRedo = useCallback(() => {
    resetSelection();
    redo();
  }, [resetSelection, redo]);

  useEffect(() => {
    initShortcuts();

    return () => {
      unregisterAllShortcuts();
    };
  }, []);

  const onShortcut = useCallback(
    (payload: ShortCutEventPayload) => {
      switch (payload.type) {
        case ShortCutEventType.QUICK_SAVE:
          projectStore.save();
          break;
        case ShortCutEventType.SAVE_AS:
          projectStore.saveAs();
          break;
        case ShortCutEventType.IMPORT_MODEL:
          importFile(ACCEPTED_MODEL_FILE_TYPES, loadFromFile);
          break;
        case ShortCutEventType.OPEN_PROJECT:
          importFile([PROJECT_FILE_TYPE], projectStore.load);
          break;
        case ShortCutEventType.OPEN_SETTINGS:
          openSettings();
          break;
        case ShortCutEventType.EXPORT_ZIP:
          PubSub.emit(EventType.START_EXPORT, "zip");
          break;
        case ShortCutEventType.EXPORT_GIF:
          PubSub.emit(EventType.START_EXPORT, "gif");
          break;
        case ShortCutEventType.EXPORT_SPRITE_SHEET:
          PubSub.emit(EventType.START_EXPORT, "spritesheet");
          break;
        case ShortCutEventType.UNDO:
          onUndo();
          break;
        case ShortCutEventType.REDO:
          onRedo();
          break;
        case ShortCutEventType.CREATE_SEQUENCE:
          PubSub.emit(EventType.START_ASSETS_CREATION);
          break;
        case ShortCutEventType.ROTATE_LEFT:
          PubSub.emit(EventType.ROTATE_CAMERA, {
            degrees: 15,
            direction: "right",
          });
          break;
        case ShortCutEventType.ROTATE_RIGHT:
          PubSub.emit(EventType.ROTATE_CAMERA, {
            degrees: 15,
            direction: "left",
          });
          break;
        case ShortCutEventType.ROTATE_UP:
          PubSub.emit(EventType.ROTATE_CAMERA, {
            degrees: 15,
            direction: "down",
          });
          break;
        case ShortCutEventType.ROTATE_DOWN:
          PubSub.emit(EventType.ROTATE_CAMERA, {
            degrees: 15,
            direction: "up",
          });
          break;
      }
    },
    [projectStore, loadFromFile, onUndo, onRedo],
  );

  useEffect(() => {
    PubSub.on(EventType.SHORT_CUT, onShortcut);

    return () => {
      PubSub.off(EventType.SHORT_CUT, onShortcut);
    };
  }, [onShortcut]);
};
