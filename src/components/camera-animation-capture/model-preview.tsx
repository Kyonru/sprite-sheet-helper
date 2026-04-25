import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { useModelsStore } from "@/store/next/models";
import { parseModel } from "@/utils/model";
import {
  landmarksToJointPositions,
  type JointPositions,
  type PoseBoneData,
  type BoneFrame,
} from "@/utils/mediapipe-to-bones";
import { JointSmoother } from "@/utils/animation-smoothing";
import type { BoneRemap } from "@/utils/bone-remap";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { ModelComponent } from "@/types/ecs";

interface BoneData {
  bone: THREE.Object3D;
  restQuat: THREE.Quaternion; // bind-pose local quaternion (reset each frame)
  restDir: THREE.Vector3; // bind-pose direction in parent-local space
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
  const localDir = dir
    .clone()
    .applyQuaternion(parentWorldQuat.clone().invert());

  // Rotation: rest direction → local target direction
  if (restDir.lengthSq() < 1e-8) return;
  const q = new THREE.Quaternion().setFromUnitVectors(restDir, localDir);
  bone.quaternion.copy(q);
  bone.updateMatrix();
}

function applyHips(hipsData: BoneData, j: JointPositions) {
  const { bone } = hipsData;

  // Hips position (scale down from meter space to rig space)
  // We skip root-motion position for preview to keep model centred
  bone.quaternion.copy(hipsData.restQuat);

  // With Y-up worldLandmarks and -p.x: rightHip is +X, up is +Y, cross(+X,+Y) = +Z.
  // lookAt(origin, +Z, +Y) makes the matrix's -Z axis point toward +Z → character faces camera.
  const right = j.rightHip.clone().sub(j.leftHip).normalize();
  const up = j.shoulderCenter.clone().sub(j.hipCenter).normalize();
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
  staticPoseRef?: React.RefObject<PoseBoneData | null>;
  rootMotion?: boolean;
  modelScale?: number;
}

// Minimum landmark visibility to drive a bone; below this we hold the last good rotation.
const VIS_THRESHOLD = 0.5;

function PosedModel({
  object,
  landmarksRef,
  remap,
  poseDataRef,
  staticPoseRef,
  rootMotion,
  modelScale = 1,
}: PosedModelProps) {
  const boneMapRef = useRef<Map<string, BoneData>>(new Map());
  const smootherRef = useRef(new JointSmoother(1.0, 0.5));
  // Holds the last bone quaternion set while visibility was good, per bone name.
  const holdQuatRef = useRef<Map<string, THREE.Quaternion>>(new Map());
  // Root motion: hip height at rest (first frame), and the hips bone rest position.
  const restHipToFloorRef = useRef<number | null>(null);
  const hipRestPosRef = useRef<THREE.Vector3 | null>(null);

  // Re-calibrate when root motion is toggled
  useEffect(() => {
    restHipToFloorRef.current = null;
    hipRestPosRef.current = null;
  }, [rootMotion]);

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

  useFrame((_state, delta) => {
    const bm = boneMapRef.current;

    // Static playback mode — apply stored bone quaternions directly and skip live detection
    const staticPose = staticPoseRef?.current;
    if (staticPose) {
      bm.forEach(({ bone, restQuat }) => { bone.quaternion.copy(restQuat); bone.updateMatrix(); });
      const hd = bm.get(staticPose.hips.boneName);
      if (hd) { hd.bone.quaternion.copy(staticPose.hips.quaternion); hd.bone.updateMatrix(); }
      for (const f of staticPose.bones) {
        const bd = bm.get(f.boneName);
        if (bd) { bd.bone.quaternion.copy(f.quaternion); bd.bone.updateMatrix(); }
      }
      object.updateMatrixWorld(true);
      return;
    }

    const lm = landmarksRef.current;
    if (!lm || lm.length < 33) return;

    const raw = landmarksToJointPositions(lm);
    const sm = smootherRef.current;
    const dt = Math.min(delta, 0.1);

    // Smooth all joint positions with One Euro Filter before bone computation.
    // This reduces jitter from monocular depth estimation and landmark noise.
    const j: typeof raw = {
      leftShoulder: sm.smooth("lShoulder", raw.leftShoulder, dt),
      rightShoulder: sm.smooth("rShoulder", raw.rightShoulder, dt),
      leftElbow: sm.smooth("lElbow", raw.leftElbow, dt),
      rightElbow: sm.smooth("rElbow", raw.rightElbow, dt),
      leftWrist: sm.smooth("lWrist", raw.leftWrist, dt),
      rightWrist: sm.smooth("rWrist", raw.rightWrist, dt),
      leftHip: sm.smooth("lHip", raw.leftHip, dt),
      rightHip: sm.smooth("rHip", raw.rightHip, dt),
      leftKnee: sm.smooth("lKnee", raw.leftKnee, dt),
      rightKnee: sm.smooth("rKnee", raw.rightKnee, dt),
      leftAnkle: sm.smooth("lAnkle", raw.leftAnkle, dt),
      rightAnkle: sm.smooth("rAnkle", raw.rightAnkle, dt),
      leftHeel: sm.smooth("lHeel", raw.leftHeel, dt),
      rightHeel: sm.smooth("rHeel", raw.rightHeel, dt),
      leftFootIndex: sm.smooth("lFootIdx", raw.leftFootIndex, dt),
      rightFootIndex: sm.smooth("rFootIdx", raw.rightFootIndex, dt),
      nose: sm.smooth("nose", raw.nose, dt),
      hipCenter: sm.smooth("hipCenter", raw.hipCenter, dt),
      shoulderCenter: sm.smooth("shoulderCtr", raw.shoulderCenter, dt),
    };

    const hold = holdQuatRef.current;
    const vis = (idx: number) => (lm[idx].visibility ?? 1) >= VIS_THRESHOLD;

    const get = (key: keyof BoneRemap) => bm.get(remap[key]);

    // Helper: apply bone and record last-good quaternion; or restore it if occluded.
    const drive = (
      key: keyof BoneRemap,
      visOk: boolean,
      from: THREE.Vector3,
      to: THREE.Vector3,
    ) => {
      const bd = get(key);
      if (!bd) return;
      if (visOk) {
        bd.bone.quaternion.copy(bd.restQuat);
        applyBoneDirection(bd, from, to);
        hold.set(remap[key], bd.bone.quaternion.clone());
      } else {
        const saved = hold.get(remap[key]);
        if (saved) bd.bone.quaternion.copy(saved);
        else bd.bone.quaternion.copy(bd.restQuat);
      }
      bd.bone.updateMatrix();
    };

    // 1. Reset ALL bones to rest pose so we don't accumulate rotations
    bm.forEach(({ bone, restQuat }) => {
      bone.quaternion.copy(restQuat);
      bone.updateMatrix();
    });

    // 2. Apply from root → leaves (order matters: parent must be set before child)
    // MediaPipe landmark indices for visibility checks
    const L_SHOULDER = 11,
      R_SHOULDER = 12,
      L_ELBOW = 13,
      R_ELBOW = 14;
    const L_WRIST = 15,
      R_WRIST = 16,
      L_HIP = 23,
      R_HIP = 24;
    const L_KNEE = 25,
      R_KNEE = 26,
      L_ANKLE = 27,
      R_ANKLE = 28;
    const L_FOOT = 31,
      R_FOOT = 32,
      NOSE = 0;

    const hipsData = get("hips");
    if (hipsData) {
      applyHips(hipsData, j);

      if (rootMotion) {
        // Hip height above foot level — changes when crouching, jumping, sitting.
        // In our Y-up space: hipCenter ≈ 0 (origin), ankles are negative (below).
        const hipToFloor =
          j.hipCenter.y - (j.leftAnkle.y + j.rightAnkle.y) * 0.5;

        if (restHipToFloorRef.current === null) {
          restHipToFloorRef.current = hipToFloor;
          hipRestPosRef.current = hipsData.bone.position.clone();
        }

        // landmark meters → local bone units: world_delta = local * modelScale, so local = landmark / modelScale
        const deltaY = (hipToFloor - restHipToFloorRef.current) / modelScale;
        hipsData.bone.position.copy(hipRestPosRef.current!);
        hipsData.bone.position.y += deltaY;
        hipsData.bone.updateMatrix();
      }
    }

    // Spine chain — always visible (derived from hips+shoulders)
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
    drive("leftShoulder", vis(L_SHOULDER), j.shoulderCenter, j.leftShoulder);
    drive("rightShoulder", vis(R_SHOULDER), j.shoulderCenter, j.rightShoulder);

    // Arms
    drive(
      "leftArm",
      vis(L_SHOULDER) && vis(L_ELBOW),
      j.leftShoulder,
      j.leftElbow,
    );
    drive(
      "rightArm",
      vis(R_SHOULDER) && vis(R_ELBOW),
      j.rightShoulder,
      j.rightElbow,
    );

    // Forearms
    drive(
      "leftForeArm",
      vis(L_ELBOW) && vis(L_WRIST),
      j.leftElbow,
      j.leftWrist,
    );
    drive(
      "rightForeArm",
      vis(R_ELBOW) && vis(R_WRIST),
      j.rightElbow,
      j.rightWrist,
    );

    // Legs
    drive("leftUpLeg", vis(L_HIP) && vis(L_KNEE), j.leftHip, j.leftKnee);
    drive("rightUpLeg", vis(R_HIP) && vis(R_KNEE), j.rightHip, j.rightKnee);
    drive("leftLeg", vis(L_KNEE) && vis(L_ANKLE), j.leftKnee, j.leftAnkle);
    drive("rightLeg", vis(R_KNEE) && vis(R_ANKLE), j.rightKnee, j.rightAnkle);

    // Feet
    drive(
      "leftFoot",
      vis(L_ANKLE) && vis(L_FOOT),
      j.leftAnkle,
      j.leftFootIndex,
    );
    drive(
      "rightFoot",
      vis(R_ANKLE) && vis(R_FOOT),
      j.rightAnkle,
      j.rightFootIndex,
    );

    // Neck / head (nose as proxy)
    drive(
      "neck",
      vis(NOSE) && vis(L_SHOULDER) && vis(R_SHOULDER),
      j.shoulderCenter,
      j.nose,
    );
    drive(
      "head",
      vis(NOSE) && vis(L_SHOULDER) && vis(R_SHOULDER),
      j.shoulderCenter,
      j.nose,
    );

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
          bones.push({
            boneKey: key,
            boneName: remap[key],
            quaternion: bd.bone.quaternion.clone(),
          });
        }
      }
      poseDataRef.current = {
        hips: {
          boneName: remap.hips,
          // When root motion is enabled, use the actual (modified) bone position
          // so the recorded keyframes carry the vertical movement.
          position:
            rootMotion && hipsData
              ? hipsData.bone.position.clone()
              : new THREE.Vector3(),
          quaternion: hipsData
            ? hipsData.bone.quaternion.clone()
            : new THREE.Quaternion(),
        },
        bones,
      };
    }
  });

  return <primitive object={object} />;
}

interface Props {
  modelUuid: string;
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  remap: BoneRemap;
  poseDataRef?: React.RefObject<PoseBoneData | null>;
  staticPoseRef?: React.RefObject<PoseBoneData | null>;
  rootMotion?: boolean;
}

export function ModelPreview({
  modelUuid,
  landmarksRef,
  remap,
  poseDataRef,
  staticPoseRef,
  rootMotion,
}: Props) {
  const model = useModelsStore((s) => s.models[modelUuid]);
  const [object, setObject] = useState<THREE.Object3D | null>(null);
  const [modelScale, setModelScale] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!model?.file) return;
    const format = model.file.name
      .split(".")
      .pop()
      ?.toLowerCase() as ModelComponent["format"];
    if (!format) return;

    setObject(null);
    setError(null);

    parseModel(model.file, format)
      .then((parsed) => {
        // Normalise scale so model fits nicely in the preview
        const box = new THREE.Box3().setFromObject(parsed.object);
        const size = box.getSize(new THREE.Vector3()).length();
        const scale = size > 0 ? 2 / size : 1;
        if (size > 0) {
          parsed.object.scale.setScalar(scale);
          // Centre at origin
          const centre = box
            .getCenter(new THREE.Vector3())
            .multiplyScalar(scale);
          parsed.object.position.sub(centre);
        }
        setModelScale(scale);
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
      <PosedModel
        object={object}
        landmarksRef={landmarksRef}
        remap={remap}
        poseDataRef={poseDataRef}
        staticPoseRef={staticPoseRef}
        rootMotion={rootMotion}
        modelScale={modelScale}
      />
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
