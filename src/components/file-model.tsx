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
import { EventType, PubSub } from "@/lib/events";
import { useModelStore } from "@/store/model";
import { Outlines } from "@react-three/drei";
import { Select } from "@react-three/postprocessing";
import { useEffectsStore } from "@/store/effects";
import { useAnimationStore } from "@/store/animation";

type Props = {
  file: File;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

export function FileModel({ file, ...props }: Props) {
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const setRef = useModelStore((state) => state.setRef);
  const outline = useEffectsStore((state) => state.outline);
  const setClips = useAnimationStore((state) => state.setClips);
  const setMixerRef = useAnimationStore((state) => state.setMixerRef);

  useEffect(() => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const buffer = e.target?.result;
      if (!buffer || typeof buffer === "string") return;

      // Cleanup old mixer and object
      if (mixerRef.current) mixerRef.current.stopAllAction();
      setObject(null);

      const allAnimationsClips: {
        action: THREE.AnimationAction;
        clip: THREE.AnimationClip;
      }[] = [];

      try {
        switch (ext) {
          case "glb":
          case "gltf": {
            const loader = new GLTFLoader();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            loader.parse(buffer as ArrayBuffer, "", (gltf: any) => {
              const scene = gltf.scene;
              setObject(scene);

              scene.traverse(function (object: {
                isMesh: boolean;
                castShadow: boolean;
              }) {
                if (object.isMesh) object.castShadow = true;
              });

              const mixer = new THREE.AnimationMixer(scene);
              if (gltf.animations.length > 0) {
                gltf.animations.forEach((clip: THREE.AnimationClip) => {
                  allAnimationsClips.push({
                    action: mixer.clipAction(clip),
                    clip,
                  });
                });

                mixerRef.current = mixer;
              }

              setClips(allAnimationsClips);
              setMixerRef(mixer);
            });
            break;
          }

          case "fbx": {
            const loader = new FBXLoader();
            const scene = loader.parse(buffer as ArrayBuffer, "");
            setObject(scene);

            if (scene.animations?.length > 0) {
              const mixer = new THREE.AnimationMixer(scene);
              scene.animations.forEach((clip: THREE.AnimationClip) => {
                const action = mixer.clipAction(clip);
                allAnimationsClips.push({
                  action,
                  clip,
                });
              });

              mixerRef.current = mixer;

              setClips(allAnimationsClips);
              setMixerRef(mixer);
            }
            break;
          }

          case "obj": {
            const text = new TextDecoder().decode(buffer as ArrayBuffer);
            const loader = new OBJLoader();
            const obj = loader.parse(text);
            setObject(obj);
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

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
    };
  }, [file, setClips, setMixerRef]);

  useEffect(() => {
    const resetAnimations = () => {
      // mixerRef.current?.stopAllAction();
      mixerRef.current?.setTime(0);
    };

    PubSub.on(EventType.START_ASSETS_CREATION, resetAnimations);
    return () => {
      PubSub.off(EventType.START_ASSETS_CREATION, resetAnimations);
    };
  }, []);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  return object ? (
    <Select enabled={outline.enabled}>
      <mesh
        {...props}
        ref={(ref: THREE.Object3D) => {
          setRef(ref);
        }}
        // onPointerOver={(e) => props.onHover(ref)}
        // onPointerOut={(e) => props.onHover(null)}
      >
        <primitive object={object} />
        {/* <skinnedMesh
          castShadow
          receiveShadow
          // geometry={object.geometry}
          // material={materials.Ch03_Body}
          // skeleton={nodes.Ch03.skeleton}
        > */}
        <Outlines angle={0} thickness={1.1} color="red" />
        {/* </skinnedMesh> */}
      </mesh>
    </Select>
  ) : null;
}
