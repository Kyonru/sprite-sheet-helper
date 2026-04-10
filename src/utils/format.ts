import { isMac } from "./platform";

export const formatCommandByPlatform = (cmd: string) => {
  if (isMac()) {
    return cmd;
  }

  return cmd
    .replace(/⌘/g, "Ctrl+")
    .replace(/⇧/g, "Shift+")
    .replace(/⌥/g, "Alt+")
    .replace(/⏎/g, "Enter")
    .replace(/⌫/g, "Backspace");
};
