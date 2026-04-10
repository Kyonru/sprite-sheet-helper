import { useMainPanelStore } from "../store";
import { ExplorerTabs } from "./explorer";
import { EffectsTabs } from "./effects";

export function SelectedObjectTabs() {
  const tab = useMainPanelStore((state) => state.tab);
  return tab === "explorer" ? <ExplorerTabs /> : <EffectsTabs />;
}
