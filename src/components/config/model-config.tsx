import { useEffect } from "react";
import { folder, useControls } from "leva";
import { useModelStore } from "@/store/model";
import { useAnimationStore } from "@/store/animation";

export const ModelConfig = () => {
  const setPosition = useModelStore((state) => state.setPosition);
  const setScale = useModelStore((state) => state.setScale);
  const setRotation = useModelStore((state) => state.setRotation);
  const defaultScale = useModelStore((state) => state.scale);
  const defaultPosition = useModelStore((state) => state.position);
  const defaultRotation = useModelStore((state) => state.rotation);
  const clips = useAnimationStore((state) => state.clips);
  const mixer = useAnimationStore((state) => state.mixerRef);
  const model = useModelStore((state) => state.ref);

  const { position, rotation, scale, animation } = useControls(
    {
      object: folder({
        position: {
          x: defaultPosition[0] || 0,
          y: defaultPosition[1] || 0,
          z: defaultPosition[2] || 0,
        },
        rotation: {
          x: defaultRotation[0] || 0,
          y: defaultRotation[1] || 0,
          z: defaultRotation[2] || 0,
        },
        scale: defaultScale,
        animation: {
          options: clips.map((clip) => clip.clip.name),
          value: "none",
        },
      }),
    },
    [model]
  );

  useEffect(() => {
    if (mixer) {
      mixer.stopAllAction();
    }
    if (animation === "none") {
      return;
    }

    clips.find((clip) => clip.clip.name === animation)?.action.play();
  }, [animation, clips, mixer]);

  useEffect(() => {
    setPosition([position.x, position.y, position.z]);
  }, [position, setPosition]);

  useEffect(() => {
    setRotation([rotation.x, rotation.y, rotation.z]);
  }, [rotation, setRotation]);

  useEffect(() => {
    setScale(scale);
  }, [scale, setScale]);

  return null;
};
