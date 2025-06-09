import {
  TransformControls,
  type TransformControlsProps,
} from "@react-three/drei";
import * as THREE from "three";
import { forwardRef } from "react";
import { useEditorStore } from "@/store/editor";

type TransformControllerProps = {
  children: React.ReactElement<THREE.Object3D>;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  disabled?: boolean;
} & TransformControlsProps;

export const TransformController = forwardRef<
  THREE.Object3D,
  TransformControllerProps
>(({ children, position, rotation, scale, disabled, ...props }, ref) => {
  const showEditor = useEditorStore((state) => state.showEditor);
  const enabled = disabled !== undefined ? !disabled : showEditor;

  return (
    <TransformControls
      {...props}
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ref={ref}
      enabled={enabled}
      showX={enabled}
      showY={enabled}
      showZ={enabled}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {children}
    </TransformControls>
  );
});

TransformController.displayName = "TransformController";
