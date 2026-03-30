import { EventType, PubSub } from "@/lib/events";
import { useModel, useModelsStore } from "@/store/next/models";
import { useRefsStore } from "@/store/next/refs";
import type { ModelComponent as ModelComponentType } from "@/types/ecs";
import { fitObjectToCamera } from "@/utils/camera";
import { parseModel } from "@/utils/model";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useMainPanelContext } from "../panels/main/context";

export function Based({ uuid, ...props }: { uuid: string }) {
  const model = useModel(uuid);
  const setRef = useRefsStore((state) => state.setRef);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const setClips = useModelsStore((state) => state.setClips);
  const setMixerRef = useModelsStore((state) => state.setMixerRef);

  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const animation = useModelsStore((state) => uuid && state.animations[uuid]);
  const clips = useModelsStore((state) => state.clips);
  const durations = useModelsStore((state) => state.durations);
  const speeds = useModelsStore((state) => state.speeds);
  const loops = useModelsStore((state) => state.loops);
  const currentTime = useModelsStore((state) => state.currentTime[uuid]);
  const freeze = useModelsStore((state) => state.freeze[uuid]);
  const setFreeze = useModelsStore((state) => state.setFreeze);

  const { controls } = useMainPanelContext();

  useFrame((_, delta) => {
    if (freeze) return;
    mixerRef.current?.update(delta);
  });

  useEffect(() => {
    const openFile = async () => {
      if (model?.file) {
        const format = model?.file?.name
          .split(".")
          .pop()
          ?.toLowerCase() as ModelComponentType["format"];

        if (!format) return;

        const parsed = await parseModel(model.file, format);

        setObject(parsed.object);

        mixerRef.current = parsed.mixer;

        const camera = controls?.camera;

        if (camera) {
          const scale = fitObjectToCamera(parsed.object, camera, 0.8);
          parsed.object.scale.setScalar(scale);
        }

        setClips(uuid, parsed.clips);

        setMixerRef(uuid, parsed.mixer);
      }
    };

    openFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, setClips, setMixerRef, uuid]);

  useEffect(() => {
    const resetAnimations = () => {
      mixerRef.current?.setTime(0);
    };
    PubSub.on(EventType.START_ASSETS_CREATION, resetAnimations);
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, resetAnimations);
    };
  }, []);

  useEffect(() => {
    if (!mixerRef.current) return;

    mixerRef.current.stopAllAction();
    if (!animation || animation === "none") {
      return;
    }
    const entityClips = clips[uuid];
    const clip = entityClips?.find((c) => c.clip.name === animation);

    if (!entityClips || !clip) return;

    const [trimStart, trimEnd] = durations[uuid]?.[animation] ?? [
      0,
      clip.clip.duration,
    ];

    // Derive FPS from clip tracks, fallback to 30
    const fps =
      clip.clip.tracks[0]?.times.length > 1
        ? 1 / (clip.clip.tracks[0].times[1] - clip.clip.tracks[0].times[0])
        : 30;

    const startFrame = Math.round(trimStart * fps);
    const endFrame = Math.round(trimEnd * fps);

    // Create a subclip for the trimmed range
    const trimmedClip = THREE.AnimationUtils.subclip(
      clip.clip,
      `${clip.clip.name}_trimmed`,
      startFrame,
      endFrame,
      fps,
    );

    const action = mixerRef.current.clipAction(trimmedClip);

    action.setDuration(
      (1 / (speeds[uuid]?.[animation] ?? 1)) * trimmedClip.duration,
    );
    action.reset();
    const loop = loops[uuid]?.[animation];
    action.setLoop(loop ?? THREE.LoopOnce, Infinity);
    action.play();

    // currentActionRef.current = action;

    return () => {
      action.stop();
      mixerRef.current?.uncacheAction(trimmedClip);
      mixerRef.current?.uncacheClip(trimmedClip);
    };
  }, [animation, clips, uuid, durations, speeds, loops]);

  useEffect(() => {
    if (!mixerRef.current || !currentTime) return;
    // currentActionRef.current.paused = true;
    // // currentTime is relative to the subclip, not the original clip
    // const clampedTime = Math.min(
    //   currentTime,
    //   currentActionRef.current.getClip().duration,
    // );
    setFreeze(uuid, true);
    mixerRef.current.setTime(currentTime);
  }, [currentTime, setFreeze, mixerRef, uuid]);

  if (!object) return null;

  return (
    <>
      {/* <FileModel file={model.file!} /> */}
      <mesh
        {...props}
        ref={(ref: THREE.Object3D) => {
          setRef(uuid, ref, "model");
        }}
      >
        <primitive object={object} />
      </mesh>
    </>
  );
}

// Memoized version of the component
export const ModelComponent = React.memo(Based);
