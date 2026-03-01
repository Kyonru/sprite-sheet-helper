import { useCameraValues } from "@/hooks/use-camera-values";
import { useCameraStore } from "@/store/camera";
import { useEditorStore } from "@/store/editor";
import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  useHelper,
} from "@react-three/drei";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

export const Camera = ({
  isDefault = true,
  useOrbitControls = true,
}: {
  isDefault?: boolean;
  useOrbitControls?: boolean;
}) => {
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
    orbitSettings,
    setOrbitRef,
  } = useCameraValues();

  const camera = useThree((state) => state.camera);
  const showEditor = useEditorStore((state) => state.showEditor);
  const setUIState = useCameraStore((state) => state.setUIState);

  const ortCamRef = useRef(null!);
  const persCamRef = useRef(null!);
  const ortHelper = useHelper(ortCamRef, THREE.CameraHelper);
  const persHelper = useHelper(persCamRef, THREE.CameraHelper);

  useEffect(() => {
    if (!ortHelper.current) {
      return;
    }
    if (showEditor && cameraType === "orthographic") {
      ortHelper.current.visible = true;
    } else {
      ortHelper.current.visible = false;
    }
  }, [showEditor, ortHelper, cameraType]);

  useEffect(() => {
    if (!persHelper.current) {
      return;
    }
    if (showEditor && cameraType === "perspective") {
      persHelper.current.visible = true;
    } else {
      persHelper.current.visible = false;
    }
  }, [showEditor, persHelper, cameraType]);

  return (
    <>
      {cameraType === "orthographic" ? (
        <OrthographicCamera
          ref={ortCamRef}
          makeDefault={cameraType === "orthographic" && isDefault}
          position={cameraPosition}
          zoom={zoom}
          rotation={cameraRotation}
          scale={cameraScale}
        />
      ) : (
        <PerspectiveCamera
          ref={persCamRef}
          makeDefault={cameraType === "perspective" && isDefault}
          position={cameraPosition}
          fov={fov}
          zoom={zoom}
          rotation={cameraRotation}
          scale={cameraScale}
        />
      )}
      {useGesturesControls && useOrbitControls && (
        <OrbitControls
          {...orbitSettings}
          ref={(ref) => setOrbitRef(ref)}
          enablePan={orbitSettings.enablePan && showEditor}
          enableRotate={orbitSettings.enableRotate && showEditor}
          enableZoom={orbitSettings.enableZoom && showEditor}
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
          target={[0, 0, 0]}
          makeDefault
        />
      )}
    </>
  );
};
