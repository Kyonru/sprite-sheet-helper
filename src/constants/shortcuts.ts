import { ShortCutEventType, type ShortCutEventName } from "@/lib/events";
import { CommandSymbols, type ShortCutKey } from "@/lib/shortcut-registry";

export const APP_SHORTCUTS: Record<
  ShortCutEventName,
  {
    shortcut: ShortCutKey[];
    type: ShortCutEventName;
  }
> = {
  [ShortCutEventType.QUICK_SAVE]: {
    shortcut: [CommandSymbols.Cmd, "S"],
    type: ShortCutEventType.QUICK_SAVE,
  },
  [ShortCutEventType.SAVE_AS]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Shift, "S"],
    type: ShortCutEventType.SAVE_AS,
  },
  [ShortCutEventType.IMPORT_MODEL]: {
    shortcut: [CommandSymbols.Cmd, "I"],
    type: ShortCutEventType.IMPORT_MODEL,
  },
  [ShortCutEventType.OPEN_PROJECT]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Shift, "O"],
    type: ShortCutEventType.OPEN_PROJECT,
  },
  [ShortCutEventType.OPEN_SETTINGS]: {
    shortcut: [CommandSymbols.Shift, "P"],
    type: ShortCutEventType.OPEN_SETTINGS,
  },
  [ShortCutEventType.EXPORT_ZIP]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Shift, "1"],
    type: ShortCutEventType.EXPORT_ZIP,
  },
  [ShortCutEventType.EXPORT_GIF]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Shift, "2"],
    type: ShortCutEventType.EXPORT_GIF,
  },
  [ShortCutEventType.EXPORT_SPRITE_SHEET]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Shift, "3"],
    type: ShortCutEventType.EXPORT_SPRITE_SHEET,
  },
  [ShortCutEventType.EXPORT_LUA]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Shift, "4"],
    type: ShortCutEventType.EXPORT_LUA,
  },
  [ShortCutEventType.UNDO]: {
    shortcut: [CommandSymbols.Cmd, "Z"],
    type: ShortCutEventType.UNDO,
  },
  [ShortCutEventType.REDO]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Shift, "Z"],
    type: ShortCutEventType.REDO,
  },
  [ShortCutEventType.CREATE_SEQUENCE]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Enter],
    type: ShortCutEventType.CREATE_SEQUENCE,
  },
  [ShortCutEventType.ROTATE_LEFT]: {
    shortcut: [CommandSymbols.Shift, CommandSymbols.ArrowLeft],
    type: ShortCutEventType.ROTATE_LEFT,
  },
  [ShortCutEventType.ROTATE_RIGHT]: {
    shortcut: [CommandSymbols.Shift, CommandSymbols.ArrowRight],
    type: ShortCutEventType.ROTATE_RIGHT,
  },
  [ShortCutEventType.ROTATE_UP]: {
    shortcut: [CommandSymbols.Shift, CommandSymbols.ArrowUp],
    type: ShortCutEventType.ROTATE_UP,
  },
  [ShortCutEventType.ROTATE_DOWN]: {
    shortcut: [CommandSymbols.Shift, CommandSymbols.ArrowDown],
    type: ShortCutEventType.ROTATE_DOWN,
  },
};
