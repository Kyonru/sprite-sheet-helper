import { useRef } from "react";
import { Selection } from "@react-three/postprocessing";
import { Grid } from "@react-three/drei";
import { FileModel } from "../components/file-model";
import { useModelStore } from "../store/model";
import { PostProcessingEffects } from "../components/effects";
import { Box } from "../components/box";
import { Lighting } from "../components/config/lights-config";
import { useEditorStore } from "@/store/editor";
import { TransformController } from "./transform-controller";
import { Camera } from "./camera";
import { useExport } from "@/hooks/use-export";

const TransformAsset = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformRef = useRef<any>(null);
  const modelFile = useModelStore((state) => state.file);
  const scale = useModelStore((state) => state.scale);
  const position = useModelStore((state) => state.position);
  const rotation = useModelStore((state) => state.rotation);
  const transform = useModelStore((state) => state.transform);

  const setScale = useModelStore((state) => state.setScale);
  const setPosition = useModelStore((state) => state.setPosition);
  const setRotation = useModelStore((state) => state.setRotation);
  const setUIState = useModelStore((state) => state.setUIState);

  return (
    <TransformController
      ref={transformRef}
      mode={transform}
      onMouseUp={() => {
        if (!transformRef.current?.object) return;
        const object = transformRef.current.object;
        setPosition([object.position.x, object.position.y, object.position.z]);
        setRotation([object.rotation.x, object.rotation.y, object.rotation.z]);
        setScale([object.scale.x, object.scale.y, object.scale.z]);
        setUIState({
          position: {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z,
          },
          scale: {
            x: object.scale.x,
            y: object.scale.y,
            z: object.scale.z,
          },
          rotation: {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z,
          },
        });
      }}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {modelFile ? <FileModel file={modelFile} /> : <Box />}
    </TransformController>
  );
};

export const AssetScene = () => {
  const showEditor = useEditorStore((state) => state.showEditor);

  useExport();

  return (
    <>
      <Lighting />
      <Selection>
        <PostProcessingEffects />
        <Camera />
        <TransformAsset />
      </Selection>
      {showEditor && (
        <Grid
          visible={showEditor}
          infiniteGrid
          sectionColor={"#a09f9f"}
          cellColor={"#868686"}
        />
      )}
    </>
  );
};
