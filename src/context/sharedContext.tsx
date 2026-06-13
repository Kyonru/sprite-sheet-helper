/* eslint-disable react-refresh/only-export-components */
import React, { type PropsWithChildren } from "react";

type SharedContextProps = Record<string, never>;

const sharedContext = React.createContext<SharedContextProps>({});

export function useSharedContext() {
  const context = React.useContext(sharedContext);
  if (!context) {
    throw new Error(
      "useSharedContext must be used within a SharedContextProvider.",
    );
  }

  return context;
}

export function SharedContextProvider({
  children,
}: PropsWithChildren<SharedContextProps>) {
  return <sharedContext.Provider value={{}}>{children}</sharedContext.Provider>;
}
