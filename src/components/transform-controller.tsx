import { useEditorStore } from "@/store/editor";
import {
  TransformControls,
  type TransformControlsProps,
} from "@react-three/drei";
import * as THREE from "three";

export const TransformController = ({
  children,
  position,
  rotation,
  scale,
  disabled,
  ...props
}: {
  children: React.ReactElement<THREE.Object3D>;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  disabled?: boolean;
} & TransformControlsProps) => {
  const showEditor = useEditorStore((state) => state.showEditor);
  const enabled = disabled !== undefined && !disabled ? disabled : showEditor;

  return (
    <TransformControls
      {...props}
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
};
