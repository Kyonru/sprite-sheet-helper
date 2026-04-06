import EventEmitter from "eventemitter3";
import { pubSubEventClient } from "../../devtools/pubsub-event-client";

export const EventType = {
  TAKE_SINGLE_SCREENSHOT: "take_single_screenshot",
  START_ASSETS_CREATION: "start_assets_creation",
  STOP_ASSETS_CREATION: "stop_assets_creation",
  SHORT_CUT: "shortcut",
  START_EXPORT: "start_export",
  STOP_EXPORT: "stop_export",
  SET_CAMERA_ANGLE: "set_camera_angle",
  ROTATE_CAMERA: "rotate_camera",
} as const;

export const ShortCutEventType = {
  EXPORT_ZIP: "shortcut_export_zip",
  EXPORT_GIF: "shortcut_export_gif",
  EXPORT_SPRITE_SHEET: "shortcut_export_sprite_sheet",
  EXPORT_LUA: "shortcut_export_lua",
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
