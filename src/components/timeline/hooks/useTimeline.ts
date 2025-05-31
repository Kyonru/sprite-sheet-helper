import { useContext } from "react";
import { TimelineContext } from "../context/timeline-context";

export function useTimelineContext() {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error(
      "useTimelineContext must be used within a TimelineProvider."
    );
  }

  return context;
}
