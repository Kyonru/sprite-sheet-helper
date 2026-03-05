/* eslint-disable react-refresh/only-export-components */
import type { StoreType } from "leva/dist/declarations/src/types";
import React, { type PropsWithChildren } from "react";

interface MainPanelContextProps {
  store?: StoreType;
}

export const MainPanelContext = React.createContext<MainPanelContextProps>({
  store: undefined,
});

export const MainPanelContextProvider = ({
  children,
  store,
}: PropsWithChildren<{
  children: React.ReactNode;
  store?: StoreType;
}>) => {
  return (
    <MainPanelContext.Provider
      value={{
        store,
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
