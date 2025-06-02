import { TimelineContext } from "./context/timeline-context";
import { DraggableTimelineEditor } from "./context/draggable.provider";
import { LevaPanel, useCreateStore } from "leva";
import { useMotionValues } from "@/hooks/use-motion-values";
import { MotionValue } from "motion/react";
import { useAnimationStateDerivedValues } from "@/hooks/use-animation-state-derived-values";
import { useAnimationStore } from "@/store/animation";

// const initialObjects: AnimationObject[] = [
//   {
//     id: "object-1",
//     name: "Box A",
//     tracks: [
//       {
//         id: "track-1",
//         property: "x",
//         keyframes: [
//           { fromValue: 0, toValue: 300, start: 0, end: 2, easing: "easeInOut" },
//           {
//             fromValue: 300,
//             toValue: 0,
//             start: 2.5,
//             end: 10,
//             easing: "linear",
//           },
//         ],
//       },
//       {
//         id: "track-2",
//         property: "opacity",
//         keyframes: [
//           {
//             fromValue: 1,
//             toValue: 0,
//             start: 2.5,
//             end: 10,
//             easing: "easeInOut",
//           },
//         ],
//       },
//     ],
//   },
//   {
//     id: "object-2",
//     name: "Box B",
//     tracks: [
//       {
//         id: "track-3",
//         property: "x",
//         keyframes: [
//           { fromValue: 300, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
//         ],
//       },
//     ],
//   },
//   {
//     id: "object-3",
//     name: "Box C",
//     tracks: [
//       {
//         id: "track-4",
//         property: "x",
//         keyframes: [
//           { fromValue: 400, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
//         ],
//       },
//     ],
//   },
//   {
//     id: "object-4",
//     name: "Box D",
//     tracks: [
//       {
//         id: "track-5",
//         property: "x",
//         keyframes: [
//           { fromValue: 0, toValue: 400, start: 0, end: 2, easing: "easeInOut" },
//           {
//             fromValue: 400,
//             toValue: 300,
//             start: 2.5,
//             end: 3,
//             easing: "easeInOut",
//           },
//         ],
//       },
//       {
//         id: "track-6",
//         property: "opacity",
//         keyframes: [
//           { fromValue: 1, toValue: 0.2, start: 1, end: 3, easing: "easeOut" },
//           {
//             fromValue: 0.2,
//             toValue: 1,
//             start: 3.5,
//             end: 4,
//             easing: "easeInOut",
//           },
//         ],
//       },
//     ],
//   },
//   {
//     id: "object-5",
//     name: "Box E",
//     tracks: [
//       {
//         id: "track-7",
//         property: "x",
//         keyframes: [
//           { fromValue: 400, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
//         ],
//       },
//     ],
//   },
//   {
//     id: "object-6",
//     name: "Box F",
//     tracks: [
//       {
//         id: "track-8",
//         property: "x",
//         keyframes: [
//           { fromValue: 400, toValue: 0, start: 0, end: 2, easing: "easeInOut" },
//         ],
//       },
//     ],
//   },
// ];

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
            top: "-1vh",
            left: "16px",
          }}
        >
          <LevaPanel
            fill
            store={uiStore}
            collapsed={false}
            titleBar={{ title: "Select object" }}
          />
          <LevaPanel
            fill
            store={propertyStore}
            collapsed={false}
            titleBar={{ title: "Select property" }}
          />
          <LevaPanel
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
