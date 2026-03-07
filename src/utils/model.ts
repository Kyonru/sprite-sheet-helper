import type { ModelComponent } from "@/types/ecs";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
const modelCache = new Map<string, THREE.Object3D>();
const mixerCache = new Map<string, THREE.AnimationMixer>();
const clipsCache = new Map<
  string,
  { action: THREE.AnimationAction; clip: THREE.AnimationClip }[]
>();

export const getModelFromCache = (uuid: string) => modelCache.get(uuid) ?? null;
export const getMixerFromCache = (uuid: string) => mixerCache.get(uuid) ?? null;
export const getClipsFromCache = (uuid: string) => clipsCache.get(uuid) ?? [];

export type ParsedModel = {
  object: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  clips: { action: THREE.AnimationAction; clip: THREE.AnimationClip }[];
};

const readFile = (file: File, asText = false): Promise<ArrayBuffer | string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (result == null) reject(new Error("Failed to read file"));
      else resolve(result as ArrayBuffer | string);
    };
    reader.onerror = () => reject(reader.error);
    if (asText) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });

export const parseModel = async (
  file: File,
  format: ModelComponent["format"],
): Promise<ParsedModel> => {
  const allClips: ParsedModel["clips"] = [];

  switch (format) {
    case "glb":
    case "gltf": {
      const buffer = (await readFile(file)) as ArrayBuffer;
      return new Promise((resolve, reject) => {
        new GLTFLoader().parse(
          buffer,
          "",
          (gltf) => {
            const scene = gltf.scene;
            scene.traverse((o: THREE.Object3D) => {
              if ((o as THREE.Mesh).isMesh) o.castShadow = true;
            });

            let mixer: THREE.AnimationMixer | null = null;
            if (gltf.animations.length > 0) {
              mixer = new THREE.AnimationMixer(scene);
              gltf.animations.forEach((clip) => {
                allClips.push({ action: mixer!.clipAction(clip), clip });
              });
            }

            resolve({ object: scene, mixer, clips: allClips });
          },
          reject,
        );
      });
    }

    case "fbx": {
      const buffer = (await readFile(file)) as ArrayBuffer;
      const fbx = new FBXLoader().parse(buffer, "");

      const wrapper = new THREE.Group();
      wrapper.add(fbx);

      let mixer: THREE.AnimationMixer | null = null;
      if (fbx.animations?.length > 0) {
        mixer = new THREE.AnimationMixer(fbx);
        fbx.animations.forEach((clip) => {
          allClips.push({ action: mixer!.clipAction(clip), clip });
        });
      }
      return { object: wrapper, mixer, clips: allClips };
    }

    case "obj": {
      const text = (await readFile(file, true)) as string;
      const obj = new OBJLoader().parse(text);
      return { object: obj, mixer: null, clips: [] };
    }

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
};
