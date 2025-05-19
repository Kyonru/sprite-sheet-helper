import { create } from "zustand";

interface AppColorState {
  color: string;
  setColor: (color: string) => void;
}

export const useAppColorStore = create<AppColorState>((set) => ({
  color: "var(--color-background)",
  setColor: (color: string) => set(() => ({ color: color })),
}));
