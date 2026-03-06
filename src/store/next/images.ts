import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";

export interface ExportRow {
  uuid: string;
  label: string;
  images: string[];
}

interface ImagesState {
  intervals: number;
  iterations: number;
  frameDelay: number;
  preview: boolean;
  images: ExportRow[];
}

interface ImagesActions {
  setIntervals: (intervals: number) => void;
  setIterations: (iterations: number) => void;
  setFrameDelay: (frameDelay: number) => void;
  setPreview: (preview: boolean) => void;
  setImages: (images: ExportRow[]) => void;
  addImagesRow: (name: string, label: string, images: string[]) => void;
  removeImagesRow: (index: number) => void;
  removeImageFromRow: (index: number, imageIndex: number) => void;
}

interface ImagesStore extends ImagesState, ImagesActions {}

export const useImagesStore = create<ImagesStore>()(
  inspector(
    (set) => ({
      mode: "spritesheet",
      intervals: 100,
      iterations: 10,
      frameDelay: 100,
      preview: false,
      images: [],

      setIntervals: (intervals) => set({ intervals }),
      setIterations: (iterations) => set({ iterations }),
      setFrameDelay: (frameDelay) => set({ frameDelay }),
      setPreview: (preview) => set({ preview }),
      setImages: (images) => set({ images }),

      addImagesRow: (uuid, label, images) =>
        set((state) => ({
          images: [...state.images, { uuid, label, images }],
        })),

      removeImagesRow: (index) =>
        set((state) => ({
          images: state.images.filter((_, i) => i !== index),
        })),

      removeImageFromRow: (index, imageIndex) =>
        set((state) => ({
          images: state.images.map((row, i) =>
            i === index
              ? {
                  ...row,
                  images: row.images.filter((_, j) => j !== imageIndex),
                }
              : row,
          ),
        })),
    }),
    { name: "Images" },
  ),
);
