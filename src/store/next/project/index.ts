// stores/project.ts
import { create } from "zustand";
import JSZip from "jszip";
import { inspector } from "@kyonru/zustand-inspector";
import { CURRENT_VERSION } from "@/types/project";
import { migrateSnapshot } from "./migration";
import { useEntitiesStore } from "../entities";
import { useTransformsStore } from "../transforms";
import { useModelsStore } from "../models";
import { useCamerasStore } from "../cameras";
import { useHistoryStore } from "../history";
import { getFileFromFS } from "@/utils/file-system/fs.web";
import { toast } from "sonner";
import { useTargetsStore } from "../targets";
import { useLightsStore } from "../lights";
import { useImagesStore } from "../images";
import { useSettingsStore } from "../settings";
import { useEffectsStore } from "../effects";
import { useMaterialsStore } from "../materials";
import { useModelDowngradesStore } from "../model-downgrades";
import { useAuthoredModelsStore } from "../authored-models";
import { setAppTitle } from "@/utils/app.web";
import { EventType, PubSub } from "@/lib/events";
import { downloadFile } from "@/utils/assets";
import saveAs from "@/lib/file/save-as.web";
import { saveFileToFS } from "@/utils/file-system/fs.web";

export interface ProjectState {
  version: number;
  savedAt: number | null;
}

interface ProjectActions {
  snapshot: () => ProjectSnapshot;
  restore: (snapshot: ProjectSnapshot) => void;
  new: () => void;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  buildZipBlob: (snapshot: ProjectSnapshot) => Promise<Blob>;
  load: (file: File) => Promise<void>;
  applySnapshot: (snapshot: ProjectSnapshot, zip: JSZip) => Promise<void>;
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
  materials: useMaterialsStore,
  modelDowngrades: useModelDowngradesStore,
  authoredModels: useAuthoredModelsStore,
};

type StoreKey = keyof typeof stores;

type StoreSnapshots = {
  [K in StoreKey]: ReturnType<
    ReturnType<(typeof stores)[K]["getState"]>["getSnapshot"]
  >;
};

type ProjectSnapshot = {
  version: number;
  savedAt: number;
} & StoreSnapshots;

export const useProjectStore = create<ProjectState & ProjectActions>()(
  inspector(
    (set, get) => ({
      version: CURRENT_VERSION,
      savedAt: null,

      snapshot: () => ({
        version: CURRENT_VERSION,
        name: useSettingsStore.getState().name,
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

      new: () => {
        const isDirty = useHistoryStore.getState().isDirty;

        if (isDirty) {
          const confirmed = window.confirm(
            "You have unsaved changes. Start a new project anyway?",
          );
          if (!confirmed) return;
        }

        (Object.keys(stores) as StoreKey[]).forEach((key) => {
          stores[key].getState().reset();
        });

        set({ savedAt: null });

        useSettingsStore.getState().setName("Untitled Project");
        useHistoryStore.getState().reset();
        setAppTitle("Untitled Project");
        PubSub.emit(EventType.NEW_PROJECT);
      },

      save: async () => {
        const snapshot = get().snapshot();
        const blob = await get().buildZipBlob(snapshot);

        downloadFile(
          blob,
          `${snapshot.settings.name.replace(/\s+/g, "_")}.sshProj`,
        );

        set({ savedAt: snapshot.savedAt });
        useHistoryStore.getState().setDirty(false);
      },

      saveAs: async () => {
        const snapshot = get().snapshot();
        const blob = await get().buildZipBlob(snapshot);

        saveAs(
          blob,
          `${snapshot.settings.name}.sshProj`,
          [".sshProj"],
          "Sprite Sheet Helper Project",
        );

        set({ savedAt: snapshot.savedAt });
        useHistoryStore.getState().setDirty(false);
      },

      // Extracted so both save and saveAs share the same zip-building logic
      buildZipBlob: async (snapshot: ProjectSnapshot): Promise<Blob> => {
        const zip = new JSZip();
        const modelsFolder = zip.folder("models")!;

        for (const [uuid, model] of Object.entries(snapshot.models.models)) {
          if (model.source === "authored") continue;
          try {
            const fileData = await getFileFromFS(uuid, "models");
            if (fileData) {
              modelsFolder.file(`${uuid}.${model.format}`, fileData);
            }
          } catch {
            toast.warning(`Could not bundle model file: ${model.fileName}`);
          }
        }

        for (const [uuid, texture] of Object.entries(
          snapshot.materials.textures,
        )) {
          try {
            const fileData = await getFileFromFS(uuid, "materials");
            if (fileData) {
              zip.file(`materials/${texture.filePath}`, fileData);
            }
          } catch {
            toast.warning(`Could not bundle material texture: ${texture.name}`);
          }
        }

        zip.file("project.json", JSON.stringify(snapshot, null, 2));
        return zip.generateAsync({ type: "blob" });
      },

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
          if (model.source === "authored") continue;
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

        for (const [uuid, texture] of Object.entries(
          snapshot.materials.textures,
        )) {
          const zipEntry = zip.file(`materials/${texture.filePath}`);
          if (!zipEntry) continue;
          const arrayBuffer = await zipEntry.async("arraybuffer");
          const file = new File([arrayBuffer], texture.fileName, {
            type: texture.mimeType,
          });
          await saveFileToFS(uuid, file, "materials");
        }

        // Hydrate all stores
        get().restore(snapshot);

        set({
          savedAt: snapshot.savedAt,
        });
        useHistoryStore.getState().setDirty(false);

        setAppTitle(snapshot.settings.name);
      },
    }),
    { name: "Project", enabled: import.meta.env.DEV },
  ),
);
