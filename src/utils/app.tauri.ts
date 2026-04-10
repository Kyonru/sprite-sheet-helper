import { getCurrentWindow } from "@tauri-apps/api/window";

export const setAppTitle = (title: string) => {
  getCurrentWindow().setTitle(`${title} — Sprite Sheet Helper`);
};
