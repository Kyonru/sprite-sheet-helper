import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { useModelsStore } from "@/store/next/models";
import { parseModel } from "@/utils/model";
import { landmarksToJointPositions, type JointPositions, type PoseBoneData, type BoneFrame } from "@/utils/mediapipe-to-bones";
import type { BoneRemap } from "@/utils/bone-remap";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { ModelComponent } from "@/types/ecs";

// ── Bone application ────────────────────────────────────────────────────────

interface BoneData {
  bone: THREE.Object3D;
  restQuat: THREE.Quaternion; // bind-pose local quaternion (reset each frame)
  restDir: THREE.Vector3;     // bind-pose direction in parent-local space
}

/**
 * Apply a world-space target direction to a bone in its parent's local space.
 *
 * Algorithm (correct parent-local approach):
 *   1. Get parent's current world quaternion (accounts for all ancestor rotations)
 *   2. Convert world target direction → parent-local direction
 *   3. Rotate from the bone's rest direction to that local direction
 */
function applyBoneDirection(
  boneData: BoneData,
  fromWorld: THREE.Vector3,
  toWorld: THREE.Vector3,
) {
  const { bone, restDir } = boneData;
  if (!bone.parent) return;

  const dir = toWorld.clone().sub(fromWorld);
  if (dir.lengthSq() < 1e-8) return;
  dir.normalize();

  // Parent's accumulated world rotation
  const parentWorldQuat = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentWorldQuat);

  // Bring world direction into parent-local space
  const localDir = dir.clone().applyQuaternion(parentWorldQuat.clone().invert());

  // Rotation: rest direction → local target direction
  if (restDir.lengthSq() < 1e-8) return;
  const q = new THREE.Quaternion().setFromUnitVectors(restDir, localDir);
  bone.quaternion.copy(q);
  bone.updateMatrix();
}

function applyHips(
  hipsData: BoneData,
  j: JointPositions,
) {
  const { bone } = hipsData;

  // Hips position (scale down from meter space to rig space)
  // We skip root-motion position for preview to keep model centred
  bone.quaternion.copy(hipsData.restQuat);

  // With Y-up worldLandmarks and -p.x: rightHip is +X, up is +Y, cross(+X,+Y) = +Z.
  // lookAt(origin, +Z, +Y) makes the matrix's -Z axis point toward +Z → character faces camera.
  const right   = j.rightHip.clone().sub(j.leftHip).normalize();
  const up      = j.shoulderCenter.clone().sub(j.hipCenter).normalize();
  const forward = new THREE.Vector3().crossVectors(right, up).normalize();

  const parentWorldQuat = new THREE.Quaternion();
  if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQuat);

  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), forward, up);
  const worldQuat = new THREE.Quaternion().setFromRotationMatrix(m);
  const localQuat = worldQuat.premultiply(parentWorldQuat.invert());
  bone.quaternion.copy(localQuat);
  bone.updateMatrix();
}

// ── Inner R3F component ──────────────────────────────────────────────────────

interface PosedModelProps {
  object: THREE.Object3D;
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  remap: BoneRemap;
  poseDataRef?: React.RefObject<PoseBoneData | null>;
}

function PosedModel({ object, landmarksRef, remap, poseDataRef }: PosedModelProps) {
  const boneMapRef = useRef<Map<string, BoneData>>(new Map());

  // Build bone map and cache rest data whenever object or remap changes
  useEffect(() => {
    // Ensure world matrices are current before reading bind-pose positions
    object.updateMatrixWorld(true);

    const map = new Map<string, THREE.Object3D>();
    object.traverse((child) => {
      if (child.name) map.set(child.name, child);
    });

    const boneMap = new Map<string, BoneData>();
    const addBone = (boneName: string) => {
      if (!boneName || boneMap.has(boneName)) return;
      const bone = map.get(boneName);
      if (!bone) return;

      const restQuat = bone.quaternion.clone();

      // Compute restDir as the bind-pose direction this bone segment points.
      // Use world-space vector from this bone's pivot → first named child's pivot,
      // then convert to parent-local space. This is correct for bones like UpLeg whose
      // joint-offset (bone.position) points sideways, not downward along the limb.
      let restDir: THREE.Vector3;
      const firstChild = bone.children.find((c) => c.name);
      if (firstChild && bone.parent) {
        const boneWP = new THREE.Vector3();
        const childWP = new THREE.Vector3();
        bone.getWorldPosition(boneWP);
        firstChild.getWorldPosition(childWP);
        const worldDir = childWP.sub(boneWP);
        if (worldDir.lengthSq() > 1e-8) {
          worldDir.normalize();
          const parentWQ = new THREE.Quaternion();
          bone.parent.getWorldQuaternion(parentWQ);
          restDir = worldDir.applyQuaternion(parentWQ.invert());
        } else {
          restDir = bone.position.clone().normalize();
        }
      } else {
        restDir = bone.position.clone().normalize();
      }

      boneMap.set(boneName, { bone, restQuat, restDir });
    };

    // Add all remapped bones
    (Object.values(remap) as string[]).forEach(addBone);
    boneMapRef.current = boneMap;
  }, [object, remap]);

  useFrame(() => {
    const lm = landmarksRef.current;
    if (!lm || lm.length < 33) return;

    const j = landmarksToJointPositions(lm);
    const bm = boneMapRef.current;

    const get = (key: keyof BoneRemap) => bm.get(remap[key]);

    // 1. Reset ALL bones to rest pose so we don't accumulate rotations
    bm.forEach(({ bone, restQuat }) => {
      bone.quaternion.copy(restQuat);
      bone.updateMatrix();
    });

    // 2. Apply from root → leaves (order matters: parent must be set before child)
    const hipsData = get("hips");
    if (hipsData) applyHips(hipsData, j);

    // Spine chain — all driven by hip→shoulder direction, split across 3 bones
    const spineOrigin = j.hipCenter.clone();
    const spineEnd = j.shoulderCenter.clone();
    const spineMid = spineOrigin.clone().lerp(spineEnd, 0.5);

    const spineData = get("spine");
    if (spineData) applyBoneDirection(spineData, spineOrigin, spineMid);

    const spine1Data = get("spine1");
    if (spine1Data) applyBoneDirection(spine1Data, spineOrigin, spineMid);

    const spine2Data = get("spine2");
    if (spine2Data) applyBoneDirection(spine2Data, spineMid, spineEnd);

    // Shoulders (clavicles)
    const lShoulderData = get("leftShoulder");
    if (lShoulderData) applyBoneDirection(lShoulderData, j.shoulderCenter, j.leftShoulder);

    const rShoulderData = get("rightShoulder");
    if (rShoulderData) applyBoneDirection(rShoulderData, j.shoulderCenter, j.rightShoulder);

    // Arms
    const lArmData = get("leftArm");
    if (lArmData) applyBoneDirection(lArmData, j.leftShoulder, j.leftElbow);

    const rArmData = get("rightArm");
    if (rArmData) applyBoneDirection(rArmData, j.rightShoulder, j.rightElbow);

    // Forearms
    const lForeData = get("leftForeArm");
    if (lForeData) applyBoneDirection(lForeData, j.leftElbow, j.leftWrist);

    const rForeData = get("rightForeArm");
    if (rForeData) applyBoneDirection(rForeData, j.rightElbow, j.rightWrist);

    // Legs
    const lUpLegData = get("leftUpLeg");
    if (lUpLegData) applyBoneDirection(lUpLegData, j.leftHip, j.leftKnee);

    const rUpLegData = get("rightUpLeg");
    if (rUpLegData) applyBoneDirection(rUpLegData, j.rightHip, j.rightKnee);

    const lLegData = get("leftLeg");
    if (lLegData) applyBoneDirection(lLegData, j.leftKnee, j.leftAnkle);

    const rLegData = get("rightLeg");
    if (rLegData) applyBoneDirection(rLegData, j.rightKnee, j.rightAnkle);

    // Feet
    const lFootData = get("leftFoot");
    if (lFootData) applyBoneDirection(lFootData, j.leftAnkle, j.leftFootIndex);

    const rFootData = get("rightFoot");
    if (rFootData) applyBoneDirection(rFootData, j.rightAnkle, j.rightFootIndex);

    // Neck: shoulder center → nose as proxy
    const neckData = get("neck");
    if (neckData) applyBoneDirection(neckData, j.shoulderCenter, j.nose);

    // Head: same direction as neck for now
    const headData = get("head");
    if (headData) applyBoneDirection(headData, j.shoulderCenter, j.nose);

    // Force scene to update matrices for next bone in chain
    object.updateMatrixWorld(true);

    // Write actual local bone quaternions so recording matches the preview exactly
    if (poseDataRef) {
      const hipsData = get("hips");
      const bones: BoneFrame[] = [];
      for (const key of Object.keys(remap) as (keyof BoneRemap)[]) {
        if (key === "hips") continue;
        const bd = bm.get(remap[key]);
        if (bd) {
          bones.push({ boneKey: key, boneName: remap[key], quaternion: bd.bone.quaternion.clone() });
        }
      }
      poseDataRef.current = {
        hips: {
          boneName: remap.hips,
          position: new THREE.Vector3(),
          quaternion: hipsData ? hipsData.bone.quaternion.clone() : new THREE.Quaternion(),
        },
        bones,
      };
    }
  });

  return <primitive object={object} />;
}

// ── Public component ─────────────────────────────────────────────────────────

interface Props {
  modelUuid: string;
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  remap: BoneRemap;
  poseDataRef?: React.RefObject<PoseBoneData | null>;
}

export function ModelPreview({ modelUuid, landmarksRef, remap, poseDataRef }: Props) {
  const model = useModelsStore((s) => s.models[modelUuid]);
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!model?.file) return;
    const format = model.file.name.split(".").pop()?.toLowerCase() as ModelComponent["format"];
    if (!format) return;

    setObject(null);
    setError(null);

    parseModel(model.file, format)
      .then((parsed) => {
        // Normalise scale so model fits nicely in the preview
        const box = new THREE.Box3().setFromObject(parsed.object);
        const size = box.getSize(new THREE.Vector3()).length();
        if (size > 0) {
          parsed.object.scale.setScalar(2 / size);
          // Centre at origin
          const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(2 / size);
          parsed.object.position.sub(centre);
        }
        setObject(parsed.object);
      })
      .catch((e) => setError((e as Error).message));
  }, [model?.file]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-xs p-2 text-center">
        {error}
      </div>
    );
  }

  if (!object) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Loading model…
      </div>
    );
  }

  return (
    <Canvas camera={{ position: [0, 1, 4], fov: 45 }} shadows={false}>
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 4, 3]} intensity={1} />
      <PosedModel object={object} landmarksRef={landmarksRef} remap={remap} poseDataRef={poseDataRef} />
      <Grid
        args={[10, 10]}
        position={[0, -1, 0]}
        cellColor="#888"
        sectionColor="#555"
        fadeDistance={8}
        infiniteGrid
      />
      <OrbitControls makeDefault enableDamping={false} />
    </Canvas>
  );
}
