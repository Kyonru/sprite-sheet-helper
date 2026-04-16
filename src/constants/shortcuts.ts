import {
  GetExportShortcut,
  ShortCutEventType,
  type ExportShortcut,
  type ShortCutEventName,
} from "@/lib/events";
import { CommandSymbols, type ShortCutKey } from "@/lib/shortcut-registry";
import { ExportFormats } from "@/types/file";

const NUMBER_KEYS: ShortCutKey[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
];

const SYMBOL_KEYS: ShortCutKey[] = [
  "-",
  "=",
  "[",
  "]",
  ";",
  "'",
  ",",
  ".",
  "/",
  "\\",
];

const EXPORT_KEYS: ShortCutKey[] = [...NUMBER_KEYS, ...SYMBOL_KEYS];

export const APP_SHORTCUTS = {
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
  [ShortCutEventType.NEW_PROJECT]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Shift, "M"],
    type: ShortCutEventType.NEW_PROJECT,
  },
  [ShortCutEventType.OPEN_PROJECT]: {
    shortcut: [CommandSymbols.Cmd, CommandSymbols.Shift, "O"],
    type: ShortCutEventType.OPEN_PROJECT,
  },
  [ShortCutEventType.OPEN_SETTINGS]: {
    shortcut: [CommandSymbols.Shift, "P"],
    type: ShortCutEventType.OPEN_SETTINGS,
  },
  ...Object.fromEntries(
    ExportFormats.map((format, index) => {
      const key = EXPORT_KEYS[index];

      if (!key) {
        console.warn("Too many export formats for shortcuts");
        return null;
      }

      return [
        GetExportShortcut(format),
        {
          shortcut: [CommandSymbols.Shift, key],
          type: GetExportShortcut(format),
        },
      ];
    }).filter(Boolean) as [
      ExportShortcut,
      { shortcut: ShortCutKey[]; type: ExportShortcut },
    ][],
  ),
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
} as Record<
  ShortCutEventName,
  {
    shortcut: ShortCutKey[];
    type: ShortCutEventName;
  }
>;
