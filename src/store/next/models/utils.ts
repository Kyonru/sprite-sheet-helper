/* eslint-disable @typescript-eslint/ban-ts-comment */

import * as THREE from "three";
// @ts-ignore
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// @ts-ignore
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
// @ts-ignore
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
// @ts-ignore
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import type { ModelComponent } from "@/types/ecs";

export const loadModel = (
  filePath: string,
  format: ModelComponent["format"],
): Promise<THREE.Object3D> => {
  return new Promise((resolve, reject) => {
    switch (format) {
      case "gltf":
      case "glb": {
        new GLTFLoader().load(
          filePath,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (gltf: any) => resolve(gltf.scene),
          undefined,
          reject,
        );
        break;
      }
      case "fbx": {
        new FBXLoader().load(filePath, resolve, undefined, reject);
        break;
      }
      case "obj": {
        new OBJLoader().load(filePath, resolve, undefined, reject);
        break;
      }
      case "stl": {
        new STLLoader().load(
          filePath,
          (geometry: THREE.BufferGeometry) => {
            const mesh = new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial(),
            );
            resolve(mesh);
          },
          undefined,
          reject,
        );
        break;
      }
      default:
        reject(new Error(`Unsupported format: ${format}`));
    }
  });
};
