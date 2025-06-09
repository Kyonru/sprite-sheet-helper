import { useCameraValues } from "@/hooks/use-camera-values";
import { useEditorStore } from "@/store/editor";
import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
} from "@react-three/drei";
import { useThree } from "@react-three/fiber";

export const Camera = () => {
  const {
    position: cameraPosition,
    rotation: cameraRotation,
    scale: cameraScale,
    zoom,
    fov,
    type: cameraType,
    useGesturesControls,
  } = useCameraValues();

  const camera = useThree((state) => state.camera);
  const showEditor = useEditorStore((state) => state.showEditor);

  return (
    <>
      {cameraType === "orthographic" ? (
        <OrthographicCamera
          makeDefault={cameraType === "orthographic"}
          position={cameraPosition}
          zoom={zoom}
          rotation={cameraRotation}
          scale={cameraScale}
        />
      ) : (
        <PerspectiveCamera
          makeDefault={true}
          position={cameraPosition}
          fov={fov}
          zoom={zoom}
          rotation={cameraRotation}
          scale={cameraScale}
        />
      )}
      {useGesturesControls && (
        <OrbitControls camera={camera} enabled={showEditor} makeDefault />
      )}
    </>
  );
};
