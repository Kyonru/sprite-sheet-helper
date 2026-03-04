import { create } from "zustand";

export type MainPanelTab = "explorer" | "effects";

interface MainPanelState {
  tab: MainPanelTab;
}

interface MainPanelActions {
  setTab: (tab: MainPanelTab) => void;
}

interface MainPanelStore extends MainPanelState, MainPanelActions {}

export const useMainPanelStore = create<MainPanelStore>((set) => ({
  tab: "explorer",
  setTab: (tab) => set({ tab }),
}));
