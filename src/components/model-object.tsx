import { useEffect, useRef } from "react";
import {
  useModel,
  useModelsStore,
  getModelFromCache,
} from "@/store/next/models";
import * as THREE from "three";

export const ModelObject = ({ uuid }: { uuid: string }) => {
  const model = useModel(uuid);
  const groupRef = useRef<THREE.Group>(null);

  // If hydrated from save (idle), trigger reload
  useEffect(() => {
    if (model?.loadState === "idle") {
      useModelsStore.getState().reloadModel(uuid);
    }
  }, [uuid, model?.loadState]);

  useEffect(() => {
    if (model?.loadState !== "loaded" || !groupRef.current) return;
    const object = getModelFromCache(uuid);

    if (!object) return;

    groupRef.current.clear();
    groupRef.current.add(object);
  }, [uuid, model?.loadState]);

  if (!model || model.loadState === "loading") return null;
  if (model.loadState === "error") {
    console.warn(`Failed to load model ${uuid}:`, model.errorMessage);
    return null;
  }

  return <group ref={groupRef} />;
};
