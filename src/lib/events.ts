import EventEmitter from "eventemitter3";
import { pubSubEventClient } from "../../devtools/pubsub-event-client";
import { ExportFormats, type ExportFormat } from "@/types/file";

export const EventType = {
  TAKE_SINGLE_SCREENSHOT: "take_single_screenshot",
  START_ASSETS_CREATION: "start_assets_creation",
  STOP_ASSETS_CREATION: "stop_assets_creation",
  SET_WORKFLOW: "set_workflow",
  START_WORKFLOW: "start_workflow",
  STOP_WORKFLOW: "stop_workflow",
  ANIMATION_READY: "animation_ready",
  MODEL_READY: "model_ready",
  NEW_SEQUENCE: "new_sequence",
  SHORT_CUT: "shortcut",
  START_EXPORT: "start_export",
  STOP_EXPORT: "stop_export",
  SET_CAMERA_ANGLE: "set_camera_angle",
  ROTATE_CAMERA: "rotate_camera",
  NEW_PROJECT: "new_project",
} as const;

type ExportShortcutKey = `EXPORT_${Uppercase<ExportFormat>}`;
export type ExportShortcut = `shortcut_export_${ExportFormat}`;

export const GetExportShortcutKey = (
  format: ExportFormat,
): ExportShortcutKey => {
  return `EXPORT_${format.toUpperCase()}` as ExportShortcutKey;
};

export const GetExportShortcut = (format: ExportFormat): ExportShortcut => {
  return `shortcut_export_${format}` as ExportShortcut;
};

const exportShortcuts = Object.fromEntries(
  ExportFormats.map((format) => [
    `EXPORT_${format.toUpperCase()}`,
    `shortcut_export_${format}`,
  ]),
) as Record<ExportShortcutKey, ExportShortcut>;

export const ShortCutEventType = {
  NEW_PROJECT: "shortcut_new_project",
  ...exportShortcuts,
  QUICK_SAVE: "shortcut_quick_save",
  SAVE_AS: "shortcut_save_as",
  IMPORT_MODEL: "shortcut_import_model",
  UNDO: "shortcut_undo",
  REDO: "shortcut_redo",
  OPEN_SETTINGS: "shortcut_open_settings",
  OPEN_PROJECT: "shortcut_open_project",
  CREATE_SEQUENCE: "shortcut_create_sequence",
  ROTATE_LEFT: "shortcut_rotate_left",
  ROTATE_RIGHT: "shortcut_rotate_right",
  ROTATE_UP: "shortcut_rotate_up",
  ROTATE_DOWN: "shortcut_rotate_down",
} as const;

export type ShortCutEventName =
  (typeof ShortCutEventType)[keyof typeof ShortCutEventType];

export type ShortCutEventPayload = {
  type: ShortCutEventName;
};

export type EventTypeName = (typeof EventType)[keyof typeof EventType];

export interface EventLogEntry {
  id: number;
  event: string | symbol;
  payload: unknown;
  timestamp: number;
  listeners: number;
}

type EventBusListener = (entries: EventLogEntry[]) => void;

class InstrumentedEventEmitter extends EventEmitter {
  private log: EventLogEntry[] = [];
  private counter = 0;
  private devListeners: Set<EventBusListener> = new Set();
  public isDev = import.meta.env.DEV;
  public readonly EVENT_TYPE = EventType;
  public readonly SHORTCUT_EVENT_TYPE = ShortCutEventType;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit<T extends string | symbol>(event: T, ...args: any[]): boolean {
    if (this.isDev) {
      const entry: EventLogEntry = {
        id: this.counter++,
        event,
        payload: args[0] ?? null,
        timestamp: Date.now(),
        listeners: this.listenerCount(event),
      };
      this.log = [entry, ...this.log].slice(0, 200);
      this.devListeners.forEach((fn) => fn(this.log));

      pubSubEventClient.emit("pubsub-log", { entries: this.log });
    }
    return super.emit(event, ...args);
  }

  getLog(): EventLogEntry[] {
    return this.log;
  }

  clearLog(): void {
    this.log = [];
    this.devListeners.forEach((fn) => fn(this.log));
    pubSubEventClient.emit("pubsub-log", { entries: [] });
  }

  subscribeToLog(fn: EventBusListener): () => void {
    this.devListeners.add(fn);
    return () => this.devListeners.delete(fn);
  }
}

export const PubSub = new InstrumentedEventEmitter();
