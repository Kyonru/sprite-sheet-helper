import { create } from "zustand";
import { inspector } from "../../../devtools/inspector-middleware";
import type { SnapshotEnabledStore } from "@/types/ecs";

export interface ExportRow {
  uuid: string;
  label: string;
  images: string[];
  frameWidth: number;
  frameHeight: number;
  fps: number;
}

export interface ImagesState {
  intervals: number;
  iterations: number;
  fps: number;
  preview: boolean;
  images: ExportRow[];
  selectedRow: number;
}

interface ImagesActions extends SnapshotEnabledStore<ImagesState> {
  setIntervals: (intervals: number) => void;
  setIterations: (iterations: number) => void;
  setFPS: (fps: number) => void;
  setPreview: (preview: boolean) => void;
  setImages: (images: ExportRow[]) => void;
  addImagesRow: (
    name: string,
    label: string,
    images: string[],
    frameWidth: number,
    frameHeight: number,
    fps: number,
  ) => void;
  removeImagesRow: (index: number) => void;
  removeImageFromRow: (index: number, imageIndex: number) => void;
  updateImagesRow: (index: number, images: string[]) => void;
  updateLabel: (uuid: string, label: string) => void;
  updateWidth: (uuid: string, width: number) => void;
  updateHeight: (uuid: string, height: number) => void;
  setSelectedRow: (index: number) => void;
  addImageToRow: (
    index: number,
    image: string,
    frameWidth: number,
    frameHeight: number,
    fps: number,
  ) => void;
}

interface ImagesStore extends ImagesState, ImagesActions {}

export const useImagesStore = create<ImagesStore>()(
  inspector(
    (set, get) => ({
      mode: "spritesheet",
      selectedRow: 0,
      intervals: 100,
      iterations: 10,
      fps: 100,
      preview: false,
      images: [],

      setIntervals: (intervals) => set({ intervals }),
      setIterations: (iterations) => set({ iterations }),
      setFPS: (fps) => set({ fps }),
      setPreview: (preview) => set({ preview }),
      setImages: (images) => set({ images }),

      addImagesRow: (uuid, label, images, frameWidth, frameHeight, fps) =>
        set((state) => ({
          images: [
            ...state.images,
            { uuid, label, images, frameWidth, frameHeight, fps },
          ],
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

      updateImagesRow: (index, images) =>
        set((state) => ({
          images: state.images.map((row, i) =>
            i === index ? { ...row, images } : row,
          ),
        })),

      updateLabel: (uuid, label) =>
        set((state) => ({
          images: state.images.map((row) =>
            row.uuid === uuid ? { ...row, label } : row,
          ),
        })),

      updateWidth: (uuid, width) =>
        set((state) => ({
          images: state.images.map((row) =>
            row.uuid === uuid ? { ...row, frameWidth: width } : row,
          ),
        })),

      updateHeight: (uuid, height) =>
        set((state) => ({
          images: state.images.map((row) =>
            row.uuid === uuid ? { ...row, frameHeight: height } : row,
          ),
        })),

      setSelectedRow: (index) => set({ selectedRow: index }),

      addImageToRow: (index, image, frameWidth, frameHeight, fps) =>
        set((state) => {
          let row = state.images[index];

          const images = state.images;

          if (!row) {
            row = {
              uuid: Date.now().toString(),
              label: "Animation",
              images: [image],
              frameWidth,
              frameHeight,
              fps,
            };

            images.push(row);
          } else {
            row.images.push(image);
          }

          return {
            images: [...images],
            selectedRow: index,
          };
        }),

      getSnapshot: () => {
        return {
          images: get().images,
          fps: get().fps,
          intervals: get().intervals,
          iterations: get().iterations,
          preview: get().preview,
          selectedRow: get().selectedRow,
        };
      },

      hydrate: (snapshot) =>
        set({
          intervals: snapshot.intervals,
          iterations: snapshot.iterations,
          fps: snapshot.fps,
          preview: snapshot.preview,
          images: snapshot.images,
        }),
    }),
    { name: "Images" },
  ),
);
