import { useEffect } from "react";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { useModelStore } from "@/store/model";
import { EffectsConfig } from "./effects-config";
import { folder, useControls } from "leva";

const ModelConfig = () => {
  const setPosition = useModelStore((state) => state.setPosition);
  const setScale = useModelStore((state) => state.setScale);
  const setRotation = useModelStore((state) => state.setRotation);
  const defaultScale = useModelStore((state) => state.scale);
  const defaultPosition = useModelStore((state) => state.position);
  const defaultRotation = useModelStore((state) => state.rotation);

  const { position, rotation, scale } = useControls({
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
    }),
  });

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

export const AssetConfig = () => {
  return (
    <>
      <SidebarMenuItem key={"model"}>
        <ModelConfig />
      </SidebarMenuItem>
      <SidebarMenuItem key={"effects"}>
        <EffectsConfig />
      </SidebarMenuItem>
    </>
  );
};
