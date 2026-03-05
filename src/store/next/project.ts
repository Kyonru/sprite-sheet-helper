import { create } from "zustand";
import type { ProjectSnapshot } from "@/types/ecs";
import { useEntitiesStore } from "./entities";
import { useTransformsStore } from "./transforms";
import { useMaterialsStore } from "./materials";
import { useModelsStore } from "./models";
import { useHistoryStore } from "./history";
import { inspector } from "../../../devtools/inspector-middleware";

const CURRENT_VERSION = 1;

interface ProjectState {
  name: string;
  savedAt: number | null;
  isDirty: boolean;
}

interface ProjectActions {
  setName: (name: string) => void;
  snapshot: () => ProjectSnapshot;
  save: () => void; // saves to file download
  load: (file: File) => Promise<void>;
  applySnapshot: (snapshot: ProjectSnapshot) => void;
  markDirty: () => void;
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  inspector(
    (set, get) => ({
      name: "Untitled Project",
      savedAt: null,
      isDirty: false,

      setName: (name) => set({ name }),
      markDirty: () => set({ isDirty: true }),

      snapshot: () => ({
        version: CURRENT_VERSION,
        name: get().name,
        savedAt: Date.now(),
        entities: useEntitiesStore.getState().entities,
        children: useEntitiesStore.getState().children,
        transforms: useTransformsStore.getState().transforms,
        materials: useMaterialsStore.getState().materials,
        models: useModelsStore.getState().models,
      }),

      save: () => {
        const snapshot = get().snapshot();
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${snapshot.name.replace(/\s+/g, "_")}.json`;
        a.click();
        URL.revokeObjectURL(url);
        set({ savedAt: snapshot.savedAt, isDirty: false });
      },

      load: async (file) => {
        const text = await file.text();
        const snapshot: ProjectSnapshot = JSON.parse(text);
        // TODO: validate with zod before applying
        get().applySnapshot(snapshot);
      },

      applySnapshot: (snapshot) => {
        useEntitiesStore
          .getState()
          .hydrate(snapshot.entities, snapshot.children);
        useTransformsStore.getState().hydrate(snapshot.transforms);
        useMaterialsStore.getState().hydrate(snapshot.materials);
        useModelsStore.getState().hydrate(snapshot.models);
        set({ name: snapshot.name, savedAt: snapshot.savedAt, isDirty: false });
        useHistoryStore.getState().clear();
      },
    }),
    { name: "Project" },
  ),
);
