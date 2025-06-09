import { useEffect } from "react";
import { folder, useControls } from "leva";
import { useModelStore } from "@/store/model";
import { useAnimationStore } from "@/store/animation";
import { TRANSFORM_OPTIONS } from "@/constants/objects";

export const ModelConfig = () => {
  const setPosition = useModelStore((state) => state.setPosition);
  const setScale = useModelStore((state) => state.setScale);
  const setRotation = useModelStore((state) => state.setRotation);
  const setTransform = useModelStore((state) => state.setTransform);
  const setUIStateFunction = useModelStore((state) => state.setUIStateFunction);
  const defaultScale = useModelStore((state) => state.scale);
  const defaultPosition = useModelStore((state) => state.position);
  const defaultRotation = useModelStore((state) => state.rotation);
  const defaultTransform = useModelStore((state) => state.transform);
  const clips = useAnimationStore((state) => state.clips);
  const mixer = useAnimationStore((state) => state.mixerRef);
  const model = useModelStore((state) => state.ref);

  const [{ position, rotation, scale, animation, transform }, set] =
    useControls(
      "transform",
      () => ({
        object: folder({
          transform: {
            options: TRANSFORM_OPTIONS,
            value: defaultTransform!,
          },
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
          scale: {
            x: defaultScale[0] || 1,
            y: defaultScale[1] || 1,
            z: defaultScale[2] || 1,
          },
          animation: {
            options: clips.map((clip) => clip.clip.name),
            value: "none",
          },
        }),
      }),
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
    setScale([scale.x, scale.y, scale.z]);
  }, [scale, setScale]);

  useEffect(() => {
    setTransform(transform);
  }, [transform, setTransform]);

  useEffect(() => {
    setUIStateFunction(set as unknown as <T>(uiState: T) => void);
  }, [setUIStateFunction, set]);

  return null;
};
