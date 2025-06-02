import { useEffect, type ChangeEvent, useState } from "react";
import Ruler from "@scena/react-ruler";
import { LucidePlus } from "lucide-react";
import { button, useControls } from "leva";
import { DroppableKeyframe, DroppableTrack } from "./dropable-keyframe";
import { TimeIndicator } from "./time-indicator";
import { useTimelineContext } from "./hooks/useTimeline";
import { interpolate } from "./utils/animations";
import { useModelStore } from "@/store/model";
import { ObjectProperties } from "./object";
import { useMotionValues } from "@/hooks/use-motion-values";

const SelectionLayer = ({
  onSelect,
}: {
  onSelect?: (objectId: string) => void;
}) => {
  const { uiStore } = useTimelineContext();
  const modelObject = useModelStore((state) => state.ref);

  useControls(
    {
      object: {
        options: ["", modelObject?.uuid || ""],
        value: "",
      },
      done: button((get) => {
        onSelect?.(get("object"));
      }),
    },
    { store: uiStore },
    [modelObject]
  );

  return null;
};

export function BaseTimelineEditor() {
  const {
    objects,
    zoom,
    setZoom,
    duration,
    timelineWidth,
    playing,
    setPlaying,
    time,
    setTime,
    unit,
    addObject,
  } = useTimelineContext();

  const motionValues = useMotionValues();
  const [selectingObject, setSelectingObject] = useState<boolean>(false);

  const onAddObject = () => {
    setSelectingObject(true);
  };

  const onSelectObject = (uuid: string) => {
    setSelectingObject(false);
    if (!uuid) return;

    addObject(uuid);
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (!playing) return;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore

      const newTime: number = time + 0.016;
      if (newTime >= duration) {
        setPlaying(false);
        return duration;
      }

      setTime(newTime);
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, playing, time]);

  useEffect(() => {
    for (const obj of objects) {
      for (const track of obj.tracks) {
        if (!Array.isArray(track.keyframes) || track.keyframes.length === 0)
          continue;
        const value = interpolate(time, track.keyframes);
        if (motionValues?.current[obj.id][track.property]) {
          motionValues.current[obj.id][track.property].set(value);
        }
      }
    }
  }, [time, objects, motionValues]);

  const handleTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setTime(newTime);
    setPlaying(false);
  };

  return (
    <>
      {/* Preview items */}
      {/* <div className="h-32 flex items-center gap-4">
        {objects.map((obj) => (
          <motion.div
            key={obj.id}
            className="w-12 h-12 bg-chart-3 rounded"
            style={{
              x: motionValues?.current[obj.id].x,
              opacity: motionValues?.current[obj.id].opacity,
              y: motionValues?.current[obj.id].y,
            }}
          />
        ))}
      </div> */}
      {selectingObject && <SelectionLayer onSelect={onSelectObject} />}
      <div className="p-4 bg-primary-foreground font-sans space-y-4 no-scrollbar">
        <div className="flex items-center gap-2">
          <button
            className="bg-blue-500 text-white w-32 px-3 py-1 rounded"
            onClick={() => {
              setPlaying(!playing);
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <p className="text-sm w-32">Time: {time.toFixed(2)}s</p>
          <input
            type="range"
            min="0"
            max={duration}
            step="0.01"
            value={time}
            onChange={handleTimeChange}
            className="w-48"
          />
          <label className="ml-4 text-sm">Zoom</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
          />
        </div>
        <div
          className="flex flex-col w-full"
          onScroll={(e) => {
            console.log(e);
          }}
        >
          {/* Shared horizontal scroll container */}
          <div className="w-full overflow-x-auto no-scrollbar max-h-64 overflow-y-auto">
            <div
              style={{ width: timelineWidth }}
              className="flex flex-col min-w-max"
            >
              {/* Top timeline header */}
              <div className="flex sticky z-200 top-0">
                <div
                  onClick={onAddObject}
                  className="w-[150px] sticky z-100 top-0 left-0 border-b border-r h-[32px] bg-muted active:opacity-50 flex items-center justify-center"
                >
                  <LucidePlus className="w-4 h-4 text-muted-foreground" />
                </div>
                <div
                  className="relative h-8"
                  onClick={(e) => {
                    const newTime =
                      (e.nativeEvent.offsetX / timelineWidth) * duration;
                    setTime(newTime);
                  }}
                >
                  <Ruler
                    type="horizontal"
                    width={timelineWidth}
                    unit={unit}
                    zoom={zoom}
                    textFormat={(scale) => {
                      return `${Math.round(scale / unit)}s`;
                    }}
                  />
                  <TimeIndicator />
                </div>
              </div>
              {/* Tracks content */}
              {objects.map((obj) => (
                <div key={obj.id} className="flex flex-row">
                  <ObjectProperties obj={obj} />
                  <DroppableTrack id={obj.id}>
                    {obj.tracks.map((track, j) =>
                      track.keyframes.map((kf, i) => {
                        const left = (kf.start / duration) * timelineWidth;
                        const width =
                          ((kf.end - kf.start) / duration) * timelineWidth;
                        const keyDuration = kf.end - kf.start;
                        return (
                          <DroppableKeyframe
                            id={`${track.id}-${i}`}
                            key={i}
                            title={`${track.property}: ${kf.fromValue} → ${kf.toValue}`}
                            row={j}
                            left={left}
                            width={width}
                            duration={keyDuration}
                            objectId={obj.id}
                            trackId={track.id}
                            keyframeIndex={i}
                          />
                        );
                      })
                    )}
                    <div
                      className="absolute w-1 z-50 h-full bg-[#cb2c36] "
                      style={{
                        left: `${(time / duration) * timelineWidth}px`,
                      }}
                    />
                  </DroppableTrack>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
