/* eslint-disable react-refresh/only-export-components */
import type { CameraControls } from "@react-three/drei";
import type { StoreType } from "leva/dist/declarations/src/types";
import React, { useState, type PropsWithChildren } from "react";

interface MainPanelContextProps {
  store?: StoreType;
  setStore: (store: StoreType) => void;
  controls: CameraControls | null;
  setControls: (controls: CameraControls | null) => void;
}

export const MainPanelContext = React.createContext<MainPanelContextProps>({
  store: undefined,
  setStore: () => {},
  controls: null,
  setControls: () => {},
});

export const MainPanelContextProvider = ({
  children,
  defaultStore,
}: PropsWithChildren<{
  children: React.ReactNode;
  defaultStore?: StoreType;
}>) => {
  const [store, setStore] = useState(defaultStore);

  const [controls, setControls] = useState<CameraControls | null>(null);

  return (
    <MainPanelContext.Provider
      value={{
        store,
        setStore,
        controls,
        setControls,
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
