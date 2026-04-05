// stores/project.ts
import { create } from "zustand";
import JSZip from "jszip";
import { inspector } from "../../../../devtools/inspector-middleware";
import { CURRENT_VERSION } from "@/types/project";
import { migrateSnapshot } from "./migration";
import { useEntitiesStore } from "../entities";
import { useTransformsStore } from "../transforms";
import { useModelsStore } from "../models";
import { useCamerasStore } from "../cameras";
import { useHistoryStore } from "../history";
import { downloadFile, getFileFromOPFS } from "@/utils/fs";
import { toast } from "sonner";
import { useTargetsStore } from "../targets";
import { useLightsStore } from "../lights";
import { useImagesStore } from "../images";
import { useSettingsStore } from "../settings";
import { useEffectsStore } from "../effects";
import { setAppTitle } from "@/utils/app";

export interface ProjectState {
  version: number;
  name: string;
  savedAt: number | null;
  isDirty: boolean;
}

interface ProjectActions {
  setName: (name: string) => void;
  snapshot: () => ProjectSnapshot;
  restore: (snapshot: ProjectSnapshot) => void;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  buildZipBlob: (snapshot: ProjectSnapshot) => Promise<Blob>;
  load: (file: File) => Promise<void>;
  applySnapshot: (snapshot: ProjectSnapshot, zip: JSZip) => Promise<void>;
  updateName: (name: string) => void;
  markDirty: () => void;
}

const stores = {
  entities: useEntitiesStore,
  settings: useSettingsStore,
  images: useImagesStore,
  lights: useLightsStore,
  transforms: useTransformsStore,
  targets: useTargetsStore,
  models: useModelsStore,
  cameras: useCamerasStore,
  history: useHistoryStore,
  effects: useEffectsStore,
};

type StoreKey = keyof typeof stores;

type StoreSnapshots = {
  [K in StoreKey]: ReturnType<
    ReturnType<(typeof stores)[K]["getState"]>["getSnapshot"]
  >;
};

type ProjectSnapshot = {
  version: number;
  name: string;
  savedAt: number;
} & StoreSnapshots;

export const useProjectStore = create<ProjectState & ProjectActions>()(
  inspector(
    (set, get) => ({
      version: CURRENT_VERSION,
      name: "Untitled Project",
      savedAt: null,
      isDirty: false,

      setName: (name) => set({ name }),
      markDirty: () => set({ isDirty: true }),

      snapshot: () => ({
        version: CURRENT_VERSION,
        name: get().name,
        savedAt: Date.now(),
        ...(Object.fromEntries(
          Object.entries(stores).map(([key, store]) => [
            key,
            store.getState().getSnapshot(),
          ]),
        ) as StoreSnapshots),
      }),

      restore: (snapshot: ProjectSnapshot) => {
        (Object.keys(stores) as (keyof typeof stores)[]).forEach((key) => {
          const data = snapshot[key];
          if (!data) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stores[key].getState().hydrate(data as any);
        });
      },

      save: async () => {
        const snapshot = get().snapshot();
        const blob = await get().buildZipBlob(snapshot);

        downloadFile(blob, `${snapshot.name.replace(/\s+/g, "_")}.sshProj`);

        set({ savedAt: snapshot.savedAt, isDirty: false });
      },

      saveAs: async () => {
        const snapshot = get().snapshot();
        const blob = await get().buildZipBlob(snapshot);

        if ("showSaveFilePicker" in window) {
          try {
            // @ts-expect-error - showSaveFilePicker is not yet in TypeScript's lib.dom.d.ts
            const handle = await window.showSaveFilePicker({
              suggestedName: `${snapshot.name.replace(/\s+/g, "_")}.sshProj`,
              types: [
                {
                  description: "Sprite Sheet Helper Project",
                  accept: { "application/octet-stream": [".sshProj"] },
                },
              ],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
          } catch (e) {
            // User cancelled the picker — not an error
            if ((e as Error).name === "AbortError") return;
            toast.error(`Failed to save project: ${(e as Error).message}`);
            return;
          }
        } else {
          // Fallback for browsers without File System Access API
          downloadFile(blob, `${snapshot.name.replace(/\s+/g, "_")}.sshProj`);
        }

        set({ savedAt: snapshot.savedAt, isDirty: false });
      },

      // Extracted so both save and saveAs share the same zip-building logic
      buildZipBlob: async (snapshot: ProjectSnapshot): Promise<Blob> => {
        const zip = new JSZip();
        const modelsFolder = zip.folder("models")!;

        for (const [uuid, model] of Object.entries(snapshot.models.models)) {
          try {
            const fileData = await getFileFromOPFS(uuid, "models");
            if (fileData) {
              modelsFolder.file(`${uuid}.${model.format}`, fileData);
            }
          } catch {
            toast.warning(`Could not bundle model file: ${model.fileName}`);
          }
        }

        zip.file("project.json", JSON.stringify(snapshot, null, 2));
        return zip.generateAsync({ type: "blob" });
      },

      updateName: (name) => set({ name }),

      load: async (file) => {
        try {
          const zip = await JSZip.loadAsync(file);
          const projectJson = await zip.file("project.json")?.async("string");
          if (!projectJson)
            throw new Error("Invalid .sshProj file: missing project.json");

          const raw = JSON.parse(projectJson);
          if (typeof raw.version !== "number")
            throw new Error("Missing version field");

          const snapshot = migrateSnapshot(raw);
          await get().applySnapshot(snapshot, zip);
        } catch (e) {
          toast.error(`Failed to load project: ${(e as Error).message}`);
        }
      },

      applySnapshot: async (snapshot, zip) => {
        // Restore model binaries from zip into OPFS before hydrating stores
        for (const [uuid, model] of Object.entries(snapshot.models.models)) {
          const zipEntry = zip.file(`models/${uuid}.${model.format}`);
          if (zipEntry) {
            const arrayBuffer = await zipEntry.async("arraybuffer");
            const file = new File([arrayBuffer], model.fileName, {
              type: model.type,
            });

            // Make sure to load the model into the store
            useModelsStore.getState().loadFromFile(uuid, file);
          }
        }

        // Hydrate all stores
        get().restore(snapshot);

        set({ name: snapshot.name, savedAt: snapshot.savedAt, isDirty: false });

        setAppTitle(snapshot.name);
      },
    }),
    { name: "Project" },
  ),
);
