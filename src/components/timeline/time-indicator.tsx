import { LucideTriangle } from "lucide-react";
import { useTimelineContext } from "./hooks/useTimeline";

export const TimeIndicator = () => {
  const { duration, timelineWidth, time } = useTimelineContext();
  return (
    <div
      className="absolute h-full -mt-8 w-1 z-50 bg-[#cb2c36]"
      style={{ left: `${(time / duration) * timelineWidth}px` }}
    >
      <div className="h-full w-full z-50 bg-[#cb2c36]" />
      <div className="relative">
        <LucideTriangle
          fill="#cb2c36"
          stroke="#cb2c36"
          className="absolute -top-[34px] -left-[6px] z-100 rotate-180 size-4"
          style={{
            borderColor: "red",
          }}
        />
      </div>
    </div>
  );
};
