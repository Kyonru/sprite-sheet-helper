import { useRef, useEffect, type ChangeEvent } from "react";
import { motion, MotionValue } from "motion/react";
import Ruler from "@scena/react-ruler";
import { LucidePlus } from "lucide-react";
import { DroppableKeyframe, DroppableTrack } from "./dropable-keyframe";
import type { MotionValues } from "./types";
import { TimeIndicator } from "./time-indicator";
import { useTimelineContext } from "./hooks/useTimeline";
import { interpolate } from "./utils/animations";

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
  } = useTimelineContext();
  const motionValues = useRef<Record<string, MotionValues>>({});
  objects.forEach((obj) => {
    if (!motionValues.current[obj.id]) {
      motionValues.current[obj.id] = {
        x: new MotionValue(0),
        opacity: new MotionValue(1),
      };
    }
  });

  const onAddObject = () => {
    console.log("Add object");
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (!playing) return;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      setTime((t: number) => {
        const newTime: number = t + 0.016;
        if (newTime >= duration) {
          setPlaying(false);
          return duration;
        }
        return newTime;
      });
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, playing]);

  useEffect(() => {
    for (const obj of objects) {
      for (const track of obj.tracks) {
        if (!Array.isArray(track.keyframes) || track.keyframes.length === 0)
          continue;
        const value = interpolate(time, track.keyframes);
        if (motionValues.current[obj.id][track.property]) {
          motionValues.current[obj.id][track.property].set(value);
        }
      }
    }
  }, [time, objects]);

  const handleTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setTime(newTime);
    setPlaying(false);
  };

  return (
    <>
      {/* Preview items */}
      <div className="h-32 flex items-center gap-4">
        {objects.map((obj) => (
          <motion.div
            key={obj.id}
            className="w-12 h-12 bg-chart-3 rounded"
            style={{
              x: motionValues.current[obj.id].x,
              opacity: motionValues.current[obj.id].opacity,
            }}
          />
        ))}
      </div>
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
                    console.log(e);
                    // const width = e.nativeEvent.target.clientWidth /c
                    const newTime =
                      (e.nativeEvent.offsetX / timelineWidth) * duration;
                    console.log(timelineWidth, e.nativeEvent.offsetX, newTime);
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
                  <div className="w-[150px] sticky left-0 z-100 bg-muted border-b border-r">
                    <div className="px-2 py-1 font-medium text-sm bg-popover text-popover-foreground border-b h-[32px]">
                      {obj.name}
                    </div>
                    {obj.tracks.map((track) => (
                      <div
                        key={track.id}
                        className="px-3 py-1 text-xs border-b text-muted-foreground h-6 flex items-center"
                      >
                        {track.property}
                      </div>
                    ))}
                  </div>
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
