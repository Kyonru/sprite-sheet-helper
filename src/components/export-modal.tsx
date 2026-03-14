import { useSharedContext } from "@/context/sharedContext";
import { LevaPanel } from "leva";
import { MINIMAL_LEVA_THEME } from "../constants/theming";

export function ExportModal() {
  const { levaStore } = useSharedContext();

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 999,
        width: "30vw",
        right: "4vw",
        top: "6vh",
      }}
    >
      <LevaPanel
        theme={MINIMAL_LEVA_THEME}
        fill
        titleBar={{ title: "Export Options" }}
        store={levaStore}
      />
    </div>
  );
}
