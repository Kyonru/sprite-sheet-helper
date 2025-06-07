import { useCreateStore } from "leva";
import type { StoreType } from "leva/dist/declarations/src/types";
import React, { type PropsWithChildren } from "react";

interface SharedContextProps {
  levaStore?: StoreType;
}

export const sharedContext = React.createContext<SharedContextProps>({});

export function useSharedContext() {
  const context = React.useContext(sharedContext);
  if (!context) {
    throw new Error(
      "useSharedContext must be used within a SharedContextProvider."
    );
  }

  return context;
}

export function SharedContextProvider({
  children,
}: PropsWithChildren<SharedContextProps>) {
  const levaStore = useCreateStore();

  return (
    <sharedContext.Provider value={{ levaStore }}>
      {children}
    </sharedContext.Provider>
  );
}
