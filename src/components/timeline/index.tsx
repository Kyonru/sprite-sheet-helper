import { TimelineContext } from "./context/timeline-context";
import { DraggableTimelineEditor } from "./context/draggable.provider";
import { LevaPanel, useCreateStore } from "leva";
import { useMotionValues } from "@/hooks/use-motion-values";
import { MotionValue } from "motion/react";
import { useAnimationStateDerivedValues } from "@/hooks/use-animation-state-derived-values";
import { useAnimationStore } from "@/store/animation";
import { LEVA_THEME } from "@/constants/theming";

const unit = 100;

export default function TimelineEditor() {
  const objects = useAnimationStore((state) => state.timeline);
  const zoom = useAnimationStore((state) => state.zoom);
  const setZoom = useAnimationStore((state) => state.setZoom);
  const time = useAnimationStore((state) => state.time);
  const setTime = useAnimationStore((state) => state.setTime);
  const playing = useAnimationStore((state) => state.playing);
  const setPlaying = useAnimationStore((state) => state.setPlaying);

  const onUpdateZoom = (newZoom: number) => {
    setZoom(newZoom);
  };

  const addObject = useAnimationStore((state) => state.addObject);
  const removeObject = useAnimationStore((state) => state.removeObject);
  const addProperty = useAnimationStore((state) => state.addProperty);
  const removeProperty = useAnimationStore((state) => state.removeProperty);
  const addKeyframe = useAnimationStore((state) => state.addKeyframe);
  const removeKeyframe = useAnimationStore((state) => state.removeKeyframe);
  const updateKeyframe = useAnimationStore((state) => state.updateKeyframe);

  const { duration, timelineWidth, baseWidth } =
    useAnimationStateDerivedValues();
  const uiStore = useCreateStore();
  const propertyStore = useCreateStore();
  const keyframeStore = useCreateStore();
  const motionValues = useMotionValues();

  objects.forEach((obj) => {
    if (motionValues && !motionValues.current[obj.id]) {
      motionValues.current[obj.id] = {
        x: new MotionValue(0),
        z: new MotionValue(0),
        y: new MotionValue(0),
        opacity: new MotionValue(1),
      };
    }
  });

  return (
    <TimelineContext.Provider
      value={{
        objects: objects,
        addObject,
        removeObject,
        addProperty,
        removeProperty,
        updateKeyframe,
        addKeyframe,
        removeKeyframe,
        zoom,
        setZoom: onUpdateZoom,
        duration,
        timelineWidth,
        baseWidth,
        time,
        setTime,
        playing,
        setPlaying,
        unit,
        uiStore,
        propertyStore,
        keyframeStore,
      }}
    >
      <div className="relative">
        <div
          style={{
            position: "absolute",
            top: "-12vh",
            left: "54px",
            zIndex: 999,
          }}
        >
          <LevaPanel
            theme={LEVA_THEME}
            fill
            store={uiStore}
            collapsed={false}
            titleBar={{ title: "Select object" }}
          />
          <LevaPanel
            theme={LEVA_THEME}
            fill
            store={propertyStore}
            collapsed={false}
            titleBar={{ title: "Select property" }}
          />
          <LevaPanel
            theme={LEVA_THEME}
            fill
            store={keyframeStore}
            collapsed={false}
            titleBar={{ title: "Select Keyframe Value" }}
          />
        </div>
      </div>
      <DraggableTimelineEditor />
    </TimelineContext.Provider>
  );
}
