import { PubSub } from "./events";
import { useImagesStore } from "@/store/next/images";
import { useSettingsStore } from "@/store/next/settings";
import { useEntitiesStore } from "@/store/next/entities";
import { useModelsStore } from "@/store/next/models";
import { useTransformsStore } from "@/store/next/transforms";
import { useEffectsStore } from "@/store/next/effects";
import { useModelDowngradesStore } from "@/store/next/model-downgrades";

export type SSHBridge = {
  PubSub: typeof PubSub;
  stores: {
    images: typeof useImagesStore;
    settings: typeof useSettingsStore;
    entities: typeof useEntitiesStore;
    models: typeof useModelsStore;
    transforms: typeof useTransformsStore;
    effects: typeof useEffectsStore;
    modelDowngrades: typeof useModelDowngradesStore;
  };
};

if (typeof window !== "undefined") {
  window.__SSH_BRIDGE__ = {
    PubSub,
    stores: {
      images: useImagesStore,
      settings: useSettingsStore,
      entities: useEntitiesStore,
      models: useModelsStore,
      transforms: useTransformsStore,
      effects: useEffectsStore,
      modelDowngrades: useModelDowngradesStore,
    },
  };
}
