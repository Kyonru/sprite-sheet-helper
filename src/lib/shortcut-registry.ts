// lib/shortcut-registry.ts
import { APP_SHORTCUTS } from "@/constants/shortcuts";
import {
  EventType,
  PubSub,
  type ShortCutEventName,
  type ShortCutEventPayload,
} from "@/lib/events";
import { isMac } from "@/utils/platform";

export const CommandSymbols = {
  Cmd: "⌘",
  Shift: "⇧",
  Alt: "⌥",
  Enter: "⏎",
  Backspace: "⌫",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
} as const;

export type ShortCutKey =
  | CommandSymbol
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown";

export type CommandKey = keyof typeof CommandSymbols;
export type CommandSymbol = (typeof CommandSymbols)[CommandKey];

const symbolToModifier: Record<CommandSymbol, string> = {
  [CommandSymbols.Cmd]: isMac() ? "meta" : "ctrl",
  [CommandSymbols.Shift]: "shift",
  [CommandSymbols.Alt]: "alt",
  [CommandSymbols.Enter]: "enter",
  [CommandSymbols.Backspace]: "backspace",
  [CommandSymbols.ArrowLeft]: "arrowleft",
  [CommandSymbols.ArrowRight]: "arrowright",
  [CommandSymbols.ArrowUp]: "arrowup",
  [CommandSymbols.ArrowDown]: "arrowdown",
};

let initialized = false;

const registry = new Map<string, ShortCutEventName>();

const resolveCombo = (e: KeyboardEvent): string => {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("meta");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
};

export const shortcutToCombo = (shortcut: ShortCutKey[]): string => {
  const modifiers: string[] = [];
  let key = "";

  for (const symbol of shortcut) {
    const mod = symbolToModifier[symbol as CommandSymbol];

    if (mod) {
      modifiers.push(mod);
    } else {
      key = symbol.toLowerCase();
    }
  }

  return [...modifiers, key].join("+");
};

export const initShortcutRegistry = () => {
  if (initialized) return;
  initialized = true;

  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement;

    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    )
      return;

    const combo = resolveCombo(e);
    const topic = registry.get(combo);
    if (topic) {
      e.preventDefault();
      PubSub.emit(EventType.SHORT_CUT, { type: topic } as ShortCutEventPayload);
    }
  });
};

export const initShortcuts = () => {
  Object.values(APP_SHORTCUTS).forEach(({ shortcut, type }) => {
    registerShortcut(shortcut, type);
  });
};

export const unregisterAllShortcuts = () => {
  registry.clear();
};

const sanatizeShortcut = (shortcut: string) => {
  if (shortcut.endsWith("+")) {
    shortcut = shortcut.slice(0, -1);
  }

  return shortcut.trim();
};

export const registerShortcut = (
  shortcut: ShortCutKey[],
  type: ShortCutEventName,
): void => {
  const combo = sanatizeShortcut(shortcutToCombo(shortcut));

  if (import.meta.env.DEV && registry.has(combo)) {
    const existing = registry.get(combo);
    if (existing !== type) {
      console.warn(
        `[shortcuts] Conflict: "${combo}" is already registered to "${existing}", overwriting with "${type}"`,
      );
    }
  }

  registry.set(combo, type);
};

export const unregisterShortcut = (shortcut: ShortCutKey[]): void => {
  const combo = shortcutToCombo(shortcut);
  registry.delete(combo);
};
