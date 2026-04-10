import { EffectComposer } from "postprocessing";
import { create } from "zustand";

type Composer = EffectComposer | null;

interface SceneState {
  composer?: Composer;
}

interface SceneActions {
  setComposer: (composer?: Composer) => void;
}

interface SceneStore extends SceneState, SceneActions {}

export const useSceneStore = create<SceneStore>((set) => ({
  composer: undefined,
  setComposer: (composer) => set(() => ({ composer: composer })),
}));
