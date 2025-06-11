import { useCameraValues } from "@/hooks/use-camera-values";
import { useCameraStore } from "@/store/camera";
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
    setPosition,
    setRotation,
    setScale,
    setZoom,
  } = useCameraValues();

  const camera = useThree((state) => state.camera);
  const showEditor = useEditorStore((state) => state.showEditor);
  const setUIState = useCameraStore((state) => state.setUIState);

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
        <OrbitControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onEnd={(e: any) => {
            if (!e?.target || !e.target.object) return;
            const object = e.target.object;

            setPosition(object.position);
            setRotation(object.rotation);
            setScale(object.scale);
            setZoom(camera.zoom);

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
              zoom: camera.zoom,
            });
          }}
          camera={camera}
          enabled={showEditor}
          makeDefault
        />
      )}
    </>
  );
};
