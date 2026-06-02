import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid, TransformControls } from "@react-three/drei";
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
import {
  quaternionToEulerDeg,
  type PoseBoneOverride,
} from "@/utils/pose-edit";
import {
  applyPoseCalibration,
  applyRetargetedPose,
  buildPreferredNamedObjectMap,
  buildPoseCalibration,
  buildRigRetargetMap,
  clampAnatomicalPose,
  scorePoseLandmarks,
  type PoseCalibration,
  type RigRetargetBone,
  type RigRetargetMap,
} from "@/utils/pose-retargeting";

function applyHips(hipsData: RigRetargetBone, j: JointPositions) {
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

function buildPoseDataFromRig(rigMap: RigRetargetMap, rootMotion?: boolean) {
  const hipsData = rigMap.bones.get("hips");
  const bones: BoneFrame[] = [];

  rigMap.bones.forEach((boneData, key) => {
    if (key === "hips") return;
    bones.push({
      boneKey: key,
      boneName: boneData.boneName,
      quaternion: boneData.bone.quaternion.clone(),
    });
  });

  return {
    hips: {
      boneName: hipsData?.boneName ?? "",
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

function applyPoseDataToRig(
  rigMap: RigRetargetMap,
  pose: PoseBoneData,
  applyHipsPosition = true,
) {
  const hipsData = rigMap.bones.get("hips");
  if (hipsData) {
    hipsData.bone.quaternion.copy(pose.hips.quaternion);
    if (applyHipsPosition) hipsData.bone.position.copy(pose.hips.position);
    hipsData.bone.updateMatrix();
  }

  for (const frame of pose.bones) {
    const boneData = rigMap.bones.get(frame.boneKey);
    if (!boneData) continue;
    boneData.bone.quaternion.copy(frame.quaternion);
    boneData.bone.updateMatrix();
  }
}

// ── Inner R3F component ──────────────────────────────────────────────────────

interface PosedModelProps {
  object: THREE.Object3D;
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  remap: BoneRemap;
  poseDataRef?: React.RefObject<PoseBoneData | null>;
  calibrationRef?: React.RefObject<PoseCalibration | null>;
  calibrationRequestId?: number;
  onCalibrationReady?: (calibration: PoseCalibration) => void;
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
  calibrationRef,
  calibrationRequestId = 0,
  onCalibrationReady,
  staticPoseRef,
  rootMotion,
  modelScale = 1,
}: PosedModelProps) {
  const rigMapRef = useRef<RigRetargetMap>({
    bones: new Map(),
    byName: new Map(),
  });
  const smootherRef = useRef(new JointSmoother(1.0, 0.5));
  // Holds the last bone quaternion set while visibility was good, per bone name.
  const holdQuatRef = useRef<Map<string, THREE.Quaternion>>(new Map());
  const lastCalibrationRequestRef = useRef(0);
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
    rigMapRef.current = buildRigRetargetMap(object, remap);
    holdQuatRef.current.clear();
    if (calibrationRef) calibrationRef.current = null;
  }, [calibrationRef, object, remap]);

  useFrame((_state, delta) => {
    const rigMap = rigMapRef.current;

    // Static playback mode — apply stored bone quaternions directly and skip live detection
    const staticPose = staticPoseRef?.current;
    if (staticPose) {
      rigMap.bones.forEach(({ bone, restQuat }) => {
        bone.quaternion.copy(restQuat);
        bone.updateMatrix();
      });
      applyPoseDataToRig(rigMap, staticPose);
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
    const quality = scorePoseLandmarks(lm);

    const get = (key: keyof BoneRemap) => rigMap.bones.get(key);

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
        applyRetargetedPose(bd, from, to);
        hold.set(key, bd.bone.quaternion.clone());
      } else {
        const saved = hold.get(key);
        if (saved && quality.score >= 0.52) {
          bd.bone.quaternion.copy(saved);
        } else if (saved) {
          bd.bone.quaternion
            .copy(bd.restQuat)
            .slerp(saved, Math.max(0.1, quality.score * 0.5));
        } else {
          bd.bone.quaternion.copy(bd.restQuat);
        }
      }
      bd.bone.updateMatrix();
    };

    // 1. Reset ALL bones to rest pose so we don't accumulate rotations
    rigMap.bones.forEach(({ bone, restQuat }) => {
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
    if (spineData) applyRetargetedPose(spineData, spineOrigin, spineMid);
    const spine1Data = get("spine1");
    if (spine1Data) applyRetargetedPose(spine1Data, spineOrigin, spineMid);
    const spine2Data = get("spine2");
    if (spine2Data) applyRetargetedPose(spine2Data, spineMid, spineEnd);

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

    const rawPose = buildPoseDataFromRig(rigMap, rootMotion);
    if (
      calibrationRequestId > 0 &&
      calibrationRequestId !== lastCalibrationRequestRef.current
    ) {
      const calibration = buildPoseCalibration(rawPose, rigMap);
      if (calibrationRef) calibrationRef.current = calibration;
      lastCalibrationRequestRef.current = calibrationRequestId;
      onCalibrationReady?.(calibration);
    }

    const calibratedPose = applyPoseCalibration(
      rawPose,
      calibrationRef?.current,
    );
    const finalPose = clampAnatomicalPose(calibratedPose, rigMap);
    applyPoseDataToRig(rigMap, finalPose, Boolean(rootMotion));
    object.updateMatrixWorld(true);

    // Write actual local bone quaternions so recording matches the preview exactly
    if (poseDataRef) poseDataRef.current = finalPose;
  });

  return <primitive object={object} />;
}

function setDepthTest(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((item) => {
      item.depthTest = false;
    });
    return;
  }
  material.depthTest = false;
}

function PoseSkeletonHelper({ object }: { object: THREE.Object3D }) {
  const helper = useMemo(() => {
    const next = new THREE.SkeletonHelper(object);
    setDepthTest(next.material);
    next.renderOrder = 20;
    return next;
  }, [object]);

  useFrame(() => {
    helper.updateMatrixWorld(true);
  });

  useEffect(() => {
    return () => {
      helper.geometry.dispose();
      if (Array.isArray(helper.material)) {
        helper.material.forEach((material) => material.dispose());
      } else {
        helper.material.dispose();
      }
    };
  }, [helper]);

  return <primitive object={helper} />;
}

type BoneHandleProps = {
  boneKey: string;
  bone: THREE.Object3D;
  selected: boolean;
  onSelectBone?: (boneKey: string) => void;
};

function BoneHandle({
  boneKey,
  bone,
  selected,
  onSelectBone,
}: BoneHandleProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    bone.getWorldPosition(meshRef.current.position);
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelectBone?.(boneKey);
  };

  return (
    <mesh ref={meshRef} onClick={onClick} renderOrder={30}>
      <sphereGeometry args={[selected ? 0.055 : 0.038, 16, 16]} />
      <meshBasicMaterial
        color={selected ? "#22c55e" : "#38bdf8"}
        depthTest={false}
        transparent
        opacity={selected ? 1 : 0.82}
      />
    </mesh>
  );
}

type PoseEditLayerProps = {
  object: THREE.Object3D;
  remap: BoneRemap;
  selectedBoneKey?: string | null;
  onSelectBone?: (boneKey: string) => void;
  onBoneEulerChange?: (boneKey: string, euler: PoseBoneOverride) => void;
};

function PoseEditLayer({
  object,
  remap,
  selectedBoneKey,
  onSelectBone,
  onBoneEulerChange,
}: PoseEditLayerProps) {
  const boneMap = useMemo(() => buildPreferredNamedObjectMap(object), [object]);
  const entries = useMemo(
    () =>
      (Object.entries(remap) as [keyof BoneRemap, string][])
        .filter(([key]) => key !== "hips")
        .map(([key, boneName]) => ({
          key,
          boneName,
          bone: boneMap.get(boneName),
        }))
        .filter(
          (entry): entry is { key: keyof BoneRemap; boneName: string; bone: THREE.Object3D } =>
            Boolean(entry.bone),
        ),
    [boneMap, remap],
  );
  const selectedBone =
    selectedBoneKey && remap[selectedBoneKey as keyof BoneRemap]
      ? boneMap.get(remap[selectedBoneKey as keyof BoneRemap])
      : undefined;

  return (
    <>
      <PoseSkeletonHelper object={object} />
      {entries.map(({ key, bone }) => (
        <BoneHandle
          key={key}
          boneKey={key}
          bone={bone}
          selected={selectedBoneKey === key}
          onSelectBone={onSelectBone}
        />
      ))}
      {selectedBone && selectedBoneKey && (
        <TransformControls
          object={selectedBone}
          mode="rotate"
          space="local"
          size={0.65}
          onObjectChange={() =>
            onBoneEulerChange?.(
              selectedBoneKey,
              quaternionToEulerDeg(selectedBone.quaternion),
            )
          }
        />
      )}
    </>
  );
}

interface Props {
  modelUuid: string;
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  remap: BoneRemap;
  poseDataRef?: React.RefObject<PoseBoneData | null>;
  staticPoseRef?: React.RefObject<PoseBoneData | null>;
  rootMotion?: boolean;
  calibrationRef?: React.RefObject<PoseCalibration | null>;
  calibrationRequestId?: number;
  onCalibrationReady?: (calibration: PoseCalibration) => void;
  selectedBoneKey?: string | null;
  onSelectBone?: (boneKey: string) => void;
  onBoneEulerChange?: (boneKey: string, euler: PoseBoneOverride) => void;
}

export function ModelPreview({
  modelUuid,
  landmarksRef,
  remap,
  poseDataRef,
  staticPoseRef,
  rootMotion,
  calibrationRef,
  calibrationRequestId,
  onCalibrationReady,
  selectedBoneKey,
  onSelectBone,
  onBoneEulerChange,
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
        calibrationRef={calibrationRef}
        calibrationRequestId={calibrationRequestId}
        onCalibrationReady={onCalibrationReady}
        staticPoseRef={staticPoseRef}
        rootMotion={rootMotion}
        modelScale={modelScale}
      />
      {staticPoseRef && (
        <PoseEditLayer
          object={object}
          remap={remap}
          selectedBoneKey={selectedBoneKey}
          onSelectBone={onSelectBone}
          onBoneEulerChange={onBoneEulerChange}
        />
      )}
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
