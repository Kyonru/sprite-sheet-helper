/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UpdatableUIState {
  setUIState: <T>(uiState: T) => void;
  setUIStateFunction: (fn: <T>(uiState: T) => void) => void;
}

export const UpdatableUIStateDefault = (set: any) =>
  ({
    setUIState: () => {},
    setUIStateFunction: (setFunction: <T>(uiState: T) => void) =>
      set(() => ({ setUIState: setFunction })),
  } as UpdatableUIState);
