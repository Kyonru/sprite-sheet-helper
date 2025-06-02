import type { MotionValues } from "@/components/timeline/types";
import { useAnimationStore } from "@/store/animation";
import { useEffect, useRef } from "react";

// Singleton hook to get the motion values
export const useMotionValues = () => {
  const motionValuesRef = useAnimationStore((state) => state.motionValuesRef);
  const setMotionValuesRef = useAnimationStore(
    (state) => state.setMotionValuesRef
  );
  const motionValues = useRef<Record<string, MotionValues>>({});

  useEffect(() => {
    if (!motionValuesRef?.current) {
      setMotionValuesRef(motionValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return motionValuesRef;
};
