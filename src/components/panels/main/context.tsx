/* eslint-disable react-refresh/only-export-components */
import type { CameraControls } from "@react-three/drei";
import React, { useState, type PropsWithChildren } from "react";
import * as THREE from "three";

interface MainPanelContextProps {
  controls: CameraControls | null;
  setControls: (controls: CameraControls | null) => void;
  cameraHelper: THREE.CameraHelper | null;
  setCameraHelper: (cameraHelper: THREE.CameraHelper | null) => void;
}

export const MainPanelContext = React.createContext<MainPanelContextProps>({
  controls: null,
  setControls: () => {},
  cameraHelper: null,
  setCameraHelper: () => {},
});

export const MainPanelContextProvider = ({
  children,
}: PropsWithChildren<{
  children: React.ReactNode;
}>) => {
  const [controls, setControls] = useState<CameraControls | null>(null);
  const [cameraHelper, setCameraHelper] = useState<THREE.CameraHelper | null>(
    null,
  );

  return (
    <MainPanelContext.Provider
      value={{
        controls,
        setControls,
        cameraHelper,
        setCameraHelper,
      }}
    >
      {children}
    </MainPanelContext.Provider>
  );
};

export const useMainPanelContext = () => {
  const context = React.useContext(MainPanelContext);
  if (!context) {
    throw new Error(
      "useMainPanelContext must be used within a MainPanelContextProvider.",
    );
  }

  return context;
};
