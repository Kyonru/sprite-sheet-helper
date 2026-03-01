import { useSharedContext } from "@/context/sharedContext";
import { LevaPanel } from "leva";
import { LEVA_THEME } from "../constants/theming";

export function ExportModal() {
  const { levaStore } = useSharedContext();

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 999,
        right: "4vw",
        top: "6vh",
      }}
    >
      <LevaPanel
        theme={LEVA_THEME}
        fill
        titleBar={{ title: "Export Options" }}
        store={levaStore}
      />
    </div>
  );
}
