import { useModel } from "@/store/next/models";
import { useRefsStore } from "@/store/next/refs";
import type { ModelComponent as ModelComponentType } from "@/types/ecs";
import { parseModel } from "@/utils/model";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export function Based({ uuid, ...props }: { uuid: string }) {
  const model = useModel(uuid);
  const setRef = useRefsStore((state) => state.setRef);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  const [object, setObject] = useState<THREE.Object3D | null>(null);

  useFrame((_, delta) => {
    if (!mixerRef.current) return;
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

        parsed.clips[0]?.action.play();

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        globalThis.currentObject = parsed;
      }
    };

    openFile();
  }, [model]);

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
