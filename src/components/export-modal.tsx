import { useSharedContext } from "@/context/sharedContext";
import { LevaPanel } from "leva";
import { LEVA_THEME } from "../constants/theming";
import { ExportConfig } from "./config/export-config";

export function ExportModal() {
  const { levaStore } = useSharedContext();

  return (
    <div className="h-full overflow-scroll overflow-y-scroll no-scrollbar">
      <ExportConfig />
      <LevaPanel
        theme={LEVA_THEME}
        fill
        titleBar={false}
        store={levaStore}
        hidden={false}
        neverHide
        flat
      />
    </div>
  );
}
