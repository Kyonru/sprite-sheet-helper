/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
// @ts-ignore
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// @ts-ignore
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
// @ts-ignore
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

type Props = {
  file: File;
  position?: [number, number, number];
  scale?: number;
};

export function FileModel({ file, position = [0, 0, 0], scale = 1 }: Props) {
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const buffer = e.target?.result;
      if (!buffer || typeof buffer === "string") return;

      try {
        switch (ext) {
          case "glb":
          case "gltf": {
            const loader = new GLTFLoader();
            loader.parse(buffer as ArrayBuffer, "", (gltf) => {
              setObject(gltf.scene);

              if (gltf.animations.length > 0) {
                const mixer = new THREE.AnimationMixer(gltf.scene);
                gltf.animations.forEach((clip) => {
                  mixer.clipAction(clip).play();
                });
                mixerRef.current = mixer;
              }
            });
            break;
          }

          case "fbx": {
            const loader = new FBXLoader();
            const scene = loader.parse(buffer as ArrayBuffer, "");
            setObject(scene);

            if (scene.animations && scene.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(scene);
              scene.animations.forEach((clip) => {
                mixer.clipAction(clip).play();
              });
              mixerRef.current = mixer;
            }
            break;
          }

          case "obj": {
            const text = new TextDecoder().decode(buffer as ArrayBuffer);
            const loader = new OBJLoader();
            const scene = loader.parse(text);
            setObject(scene);
            break;
          }

          default:
            console.warn("Unsupported file format:", ext);
        }
      } catch (err) {
        console.error("Failed to load model:", err);
      }
    };

    if (ext === "obj") {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }, [file]);

  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  return object ? (
    <group position={position} scale={scale}>
      <primitive object={object} />
    </group>
  ) : null;
}
