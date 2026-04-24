import { useEntitiesStore, useEntity } from "@/store/next/entities";
import {
  LevaPanel,
  LevaStoreProvider,
  useControls,
  useCreateStore,
  useStoreContext,
  button,
} from "leva";
import type { Schema } from "leva/plugin";
import { useEffect, useMemo } from "react";
import { LEVA_THEME } from "@/constants/theming";
import { useModel, useModelsStore, type LoopType } from "@/store/next/models";
import * as THREE from "three";
import { openCameraCapture } from "@/components/camera-animation-capture";

const ANIMATION_LOOP_OPTIONS: Record<string, LoopType> = {
  "Loop Once": THREE.LoopOnce,
  "Loop Repeat": THREE.LoopRepeat,
  "Ping Pong": THREE.LoopPingPong,
};

const AnimationDetails = ({ uuid }: { uuid: string }) => {
  const store = useStoreContext();
  const entity = useEntity(uuid);
  const model = useModel(uuid);
  const setAnimation = useModelsStore((state) => state.setAnimation);
  const animation = useModelsStore((state) => uuid && state.animations[uuid]);
  const durations = useModelsStore((state) => state.durations);
  const setDuration = useModelsStore((state) => state.setDuration);
  const setSpeed = useModelsStore((state) => state.setSpeed);
  const speeds = useModelsStore((state) => state.speeds);
  const setLoop = useModelsStore((state) => state.setLoop);
  const loops = useModelsStore((state) => state.loops);

  const freeze = useModelsStore((state) => state.freeze[uuid]);
  const setFreeze = useModelsStore((state) => state.setFreeze);

  const currentTime = useModelsStore((state) => state.currentTime[uuid]);
  const setCurrentTime = useModelsStore((state) => state.setCurrentTime);

  const animations = useModelsStore((state) => state.clips[uuid]);

  const inputs = useMemo(() => {
    const i: Schema = {};
    if (!uuid) return i;

    if (!entity?.uuid || !uuid || !model?.file || !animations) return {};

    if (animations) {
      const animationOptions = [
        "none",
        ...animations.map((clip) => clip.clip.name),
      ];

      i["animation"] = {
        options: animationOptions,
        value: animation || "none",
        onChange: (value: string) => {
          setAnimation(uuid, value);
        },
      };
      const clip = animations.find((clip) => clip.clip.name === animation);

      i["length"] = {
        value: `${clip?.clip.duration || 0} seconds`,
        editable: false,
      };

      const duration = durations[uuid]?.[animation];

      i["duration"] = {
        min: 0,
        max: clip?.clip.duration ?? 0,
        step: 0.1,
        value: duration ?? [0, clip?.clip.duration || 0],
        onChange: (value: [number, number]) => {
          setDuration(uuid, animation, value);
        },
      };

      i["speed"] = {
        min: -1,
        max: 3,
        step: 0.1,
        value: speeds[uuid]?.[animation] ?? 1,
        onChange: (value: number) => {
          setSpeed(uuid, animation, value);
        },
      };

      i["loop"] = {
        options: ANIMATION_LOOP_OPTIONS,
        value: loops[uuid]?.[animation] ?? THREE.LoopOnce,
        onChange: (value: LoopType) => {
          setLoop(uuid, animation, value);
        },
      };

      i["freeze"] = {
        value: freeze ?? false,
        onChange: (value: boolean) => {
          setFreeze(uuid, value);
        },
      };

      if (freeze) {
        i["currentTime"] = {
          min: 0,
          max: clip?.clip.duration ?? 0,
          step: 0.1,
          value: currentTime ?? 0,
          onChange: (value: number) => {
            setCurrentTime(uuid, value);
          },
        };
      }
    }

    return i;
  }, [
    entity?.uuid,
    uuid,
    model.file,
    animations,
    animation,
    setAnimation,
    durations,
    setDuration,
    speeds,
    setSpeed,
    loops,
    setLoop,
    freeze,
    setFreeze,
    currentTime,
    setCurrentTime,
  ]);

  // Camera capture button — always visible for loaded models
  useControls(
    () => ({ "Add via Camera": button(() => openCameraCapture(uuid)) }) satisfies Schema,
    { store },
    [uuid],
  );

  // Function form + key forces Leva to remount when entity/type changes
  const [, set] = useControls(() => inputs satisfies Schema, { store }, [
    uuid,
    animation,
  ]);

  useEffect(() => {
    if (!animations) return;

    const clip = animations.find((clip) => clip.clip.name === animation);

    set({
      length: `${clip?.clip.duration ?? 0} seconds`,
    });
  }, [uuid, set, animation, animations]);

  return (
    <LevaPanel
      theme={LEVA_THEME}
      hidden={false}
      neverHide
      store={store}
      fill
      flat
      titleBar={false}
    />
  );
};

export const AnimationContext = () => {
  const selected = useEntitiesStore((state) => state.selected);
  const animationStore = useCreateStore();

  if (!selected) return null;

  return (
    <LevaStoreProvider key={selected} store={animationStore}>
      <AnimationDetails uuid={selected} />
    </LevaStoreProvider>
  );
};
