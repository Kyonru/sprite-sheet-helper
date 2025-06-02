import { create } from "zustand";

interface EditorState {
  showEditor: boolean;
  setShowEditor: (show: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  showEditor: true,
  setShowEditor: (show: boolean) => set(() => ({ showEditor: show })),
}));
