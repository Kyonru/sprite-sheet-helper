export type AssetToyboxState = {
  open: boolean;
  recipeId?: string;
};

type Listener = (state: AssetToyboxState) => void;

const listeners = new Set<Listener>();
let currentState: AssetToyboxState = { open: false };

export function openAssetToybox(recipeId?: string) {
  setAssetToyboxState({ open: true, recipeId });
}

export function setAssetToyboxState(state: AssetToyboxState) {
  currentState = state;
  listeners.forEach((listener) => listener(state));
}

export function getAssetToyboxState() {
  return currentState;
}

export function subscribeAssetToybox(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
