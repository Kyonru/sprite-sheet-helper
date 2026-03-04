import React, { type PropsWithChildren } from "react";

interface EntityContextProps {
  isPreview?: boolean;
}

const entityContext = React.createContext<EntityContextProps>({
  isPreview: false,
});

// eslint-disable-next-line react-refresh/only-export-components
export function useEntityContext() {
  const context = React.useContext(entityContext);
  if (!context) {
    throw new Error(
      "useEntityContext must be used within a EntityContextProvider.",
    );
  }

  return context;
}

export function EntityContextProvider({
  children,
  isPreview,
}: PropsWithChildren<EntityContextProps>) {
  return (
    <entityContext.Provider value={{ isPreview }}>
      {children}
    </entityContext.Provider>
  );
}
