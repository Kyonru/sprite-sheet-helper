import { useAnimationStore } from "@/store/animation";
import { getDuration } from "@/utils/animation";
import { useMemo } from "react";

export const useAnimationStateDerivedValues = () => {
  const { timeline, zoom, playing, unit } = useAnimationStore();

  const duration = useMemo(() => {
    return getDuration(timeline);
  }, [timeline]);

  const baseWidth = useMemo(() => {
    return duration * unit;
  }, [duration, unit]);

  const timelineWidth = useMemo(() => {
    return baseWidth * zoom;
  }, [baseWidth, zoom]);

  return {
    duration,
    timelineWidth,
    playing,
    baseWidth,
  };
};
