import { createContext, useContext, useRef } from "react";
import * as THREE from "three";

const SceneContext = createContext<THREE.Scene | null>(null);

export const SharedSceneProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const scene = useRef(new THREE.Scene()).current;
  return (
    <SceneContext.Provider value={scene}>{children}</SceneContext.Provider>
  );
};

export const useSharedScene = () => {
  const scene = useContext(SceneContext);
  if (!scene)
    throw new Error("useSharedScene must be used inside SharedSceneProvider");
  return scene;
};
