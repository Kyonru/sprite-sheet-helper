import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { useModelsStore } from "@/store/next/models";
import { parseModel } from "@/utils/model";
import {
  landmarksToJointPositions,
  type PoseBoneData,
} from "@/utils/mediapipe-to-bones";
import { JointSmoother } from "@/utils/animation-smoothing";
import type { BoneRemap } from "@/utils/bone-remap";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { ModelComponent } from "@/types/ecs";
import {
  quaternionToEulerDeg,
  vectorToPositionOverride,
  type PoseBoneOverride,
  type PoseFrameOverrides,
} from "@/utils/pose-edit";
import {
  IK_POLE_TARGET_EFFECTORS,
  bakeIkResultToOverrides,
  buildIkRigFromRemap,
  createIkDebugSnapshot,
  createIkPoleTargetsFromPose,
  createIkTargetsFromPose,
  getIkAvailability,
  solveFullBodyIk,
  type IkAvailability,
  type IkDebugSnapshot,
  type IkEditableTargetKey,
  type IkPoleTargetKey,
  type IkSolveResult,
} from "@/utils/pose-ik";
import {
  applyPoseDataToRig,
  createRootMotionState,
  solvePoseOntoRig,
} from "@/utils/pose-solve";
import {
  applyPoseCalibration,
  buildPreferredNamedObjectMap,
  buildPoseCalibration,
  buildRigRetargetMap,
  clampAnatomicalPose,
  type PoseCalibration,
  type RigRetargetMap,
} from "@/utils/pose-retargeting";

// ── Inner R3F component ──────────────────────────────────────────────────────

interface PosedModelProps {
  object: THREE.Object3D;
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  visibilityLandmarksRef?: React.RefObject<NormalizedLandmark[] | null>;
  remap: BoneRemap;
  poseDataRef?: React.RefObject<PoseBoneData | null>;
  calibrationRef?: React.RefObject<PoseCalibration | null>;
  calibrationRequestId?: number;
  onCalibrationReady?: (calibration: PoseCalibration) => void;
  staticPoseRef?: React.RefObject<PoseBoneData | null>;
  rootMotion?: boolean;
  landmarkSmoothing?: boolean;
  modelScale?: number;
}

function PosedModel({
  object,
  landmarksRef,
  visibilityLandmarksRef,
  remap,
  poseDataRef,
  calibrationRef,
  calibrationRequestId = 0,
  onCalibrationReady,
  staticPoseRef,
  rootMotion,
  landmarkSmoothing = true,
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
  // Root motion reference state, owned here and reused across frames so the
  // solve itself can stay a pure function.
  const rootMotionStateRef = useRef(createRootMotionState());

  // Re-calibrate when root motion is toggled
  useEffect(() => {
    rootMotionStateRef.current = createRootMotionState();
  }, [rootMotion]);

  useEffect(() => {
    smootherRef.current.reset();
  }, [landmarkSmoothing]);

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
      rigMap.bones.forEach(({ bone, restPosition, restQuat }) => {
        bone.position.copy(restPosition);
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
    const j: typeof raw = landmarkSmoothing
      ? {
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
          earCenter: sm.smooth("earCenter", raw.earCenter, dt),
          hipCenter: sm.smooth("hipCenter", raw.hipCenter, dt),
          shoulderCenter: sm.smooth("shoulderCtr", raw.shoulderCenter, dt),
        }
      : raw;

    // The whole landmarks -> rig solve lives in @/utils/pose-solve so the
    // preview, the recorder and the offline benchmark drive the rig through
    // exactly the same code. A benchmark that re-implements the solve measures
    // the benchmark.
    const solveResult = solvePoseOntoRig({
      object,
      rigMap,
      landmarks: lm,
      visibilityLandmarks: visibilityLandmarksRef?.current ?? undefined,
      joints: j,
      hold: holdQuatRef.current,
      rootMotionState: rootMotionStateRef.current,
      rootMotion,
      modelScale,
    });
    const rawPose = solveResult.pose;

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
  edited?: boolean;
  onSelectBone?: (boneKey: string) => void;
};

function BoneHandle({
  boneKey,
  bone,
  selected,
  edited,
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
        color={selected ? "#22c55e" : edited ? "#f59e0b" : "#38bdf8"}
        depthTest={false}
        transparent
        opacity={selected || edited ? 1 : 0.82}
      />
    </mesh>
  );
}

function isIkPoleTargetKey(
  key: IkEditableTargetKey | null | undefined,
): key is IkPoleTargetKey {
  return Boolean(key && key in IK_POLE_TARGET_EFFECTORS);
}

function syncIkTargetObject(
  map: Map<IkEditableTargetKey, THREE.Mesh>,
  key: IkEditableTargetKey,
  position: THREE.Vector3,
  draggingTarget: IkEditableTargetKey | null,
) {
  const object = map.get(key);
  if (!object) return undefined;
  if (draggingTarget !== key) {
    object.position.copy(position);
    object.updateMatrixWorld(true);
  }
  return object;
}

function isFiniteVector(vector: THREE.Vector3) {
  return (
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  );
}

type IkHandleProps = {
  targetKey: IkEditableTargetKey;
  position: THREE.Vector3;
  label: string;
  selected: boolean;
  pole?: boolean;
  onObjectReady: (key: IkEditableTargetKey, object: THREE.Mesh | null) => void;
  onSelect: () => void;
};

function IkHandle({
  targetKey,
  position,
  label,
  selected,
  pole,
  onObjectReady,
  onSelect,
}: IkHandleProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.name = `pose-ik-${targetKey}`;
    onObjectReady(targetKey, mesh);
    return () => onObjectReady(targetKey, null);
  }, [onObjectReady, targetKey]);

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={onClick}
      renderOrder={32}
      userData={{ label }}
    >
      {pole ? (
        <octahedronGeometry args={[selected ? 0.06 : 0.045, 0]} />
      ) : (
        <sphereGeometry args={[selected ? 0.075 : 0.055, 20, 20]} />
      )}
      <meshBasicMaterial
        color={selected ? "#f97316" : pole ? "#facc15" : "#a78bfa"}
        depthTest={false}
        transparent
        opacity={selected ? 1 : 0.85}
      />
    </mesh>
  );
}

type PoseEditLayerProps = {
  object: THREE.Object3D;
  remap: BoneRemap;
  editMode?: "fk" | "ik";
  transformMode?: "rotate" | "translate";
  selectedBoneKey?: string | null;
  selectedIkTargetKey?: IkEditableTargetKey | null;
  frameOverrides?: PoseFrameOverrides;
  onSelectBone?: (boneKey: string) => void;
  onSelectIkTarget?: (targetKey: IkEditableTargetKey) => void;
  onBoneEulerChange?: (boneKey: string, euler: PoseBoneOverride) => void;
  onBonePositionChange?: (
    boneKey: string,
    position: NonNullable<PoseBoneOverride["position"]>,
  ) => void;
  onIkSolveChange?: (
    overrides: PoseFrameOverrides,
    result: IkSolveResult,
  ) => void;
  onIkStatusChange?: (status: IkAvailability) => void;
  ikDebugRef?: React.MutableRefObject<IkDebugSnapshot | null>;
  onGizmoEditStart?: () => void;
  onGizmoEditEnd?: () => void;
  showSkeleton?: boolean;
  showHandles?: boolean;
  gizmoEnabled?: boolean;
  editedBoneKeys?: readonly string[];
};

function PoseEditLayer({
  object,
  remap,
  editMode = "fk",
  transformMode = "rotate",
  selectedBoneKey,
  selectedIkTargetKey,
  frameOverrides = {},
  onSelectBone,
  onSelectIkTarget,
  onBoneEulerChange,
  onBonePositionChange,
  onIkSolveChange,
  onIkStatusChange,
  ikDebugRef,
  onGizmoEditStart,
  onGizmoEditEnd,
  showSkeleton = true,
  showHandles = true,
  gizmoEnabled = true,
  editedBoneKeys = [],
}: PoseEditLayerProps) {
  const boneMap = useMemo(() => buildPreferredNamedObjectMap(object), [object]);
  const ikRig = useMemo(() => buildIkRigFromRemap(object, remap), [object, remap]);
  const ikStatus = useMemo(() => getIkAvailability(ikRig), [ikRig]);
  const ikTargetObjectsRef = useRef<Map<IkEditableTargetKey, THREE.Mesh>>(
    new Map(),
  );
  const draggingIkTargetRef = useRef<IkEditableTargetKey | null>(null);
  const lastIkSolveResultRef = useRef<IkSolveResult | null>(null);
  const [, setIkHandleRevision] = useState(0);
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
  const selectedIkObject =
    editMode === "ik" && selectedIkTargetKey
      ? ikTargetObjectsRef.current.get(selectedIkTargetKey)
      : undefined;
  const selectedEffectorKey = isIkPoleTargetKey(selectedIkTargetKey)
    ? IK_POLE_TARGET_EFFECTORS[selectedIkTargetKey]
    : selectedIkTargetKey;
  const selectedIkChainAvailable =
    editMode === "ik" &&
    selectedEffectorKey &&
    ikRig.chains.get(selectedEffectorKey)?.available;

  useEffect(() => {
    onIkStatusChange?.(ikStatus);
  }, [ikStatus, onIkStatusChange]);

  const registerIkTargetObject = useCallback(
    (key: IkEditableTargetKey, targetObject: THREE.Mesh | null) => {
      if (targetObject) {
        ikTargetObjectsRef.current.set(key, targetObject);
      } else {
        ikTargetObjectsRef.current.delete(key);
      }
      setIkHandleRevision((revision) => revision + 1);
    },
    [],
  );

  useFrame(() => {
    if (editMode !== "ik") return;
    const draggingTarget = draggingIkTargetRef.current;
    for (const target of createIkTargetsFromPose(ikRig)) {
      if (draggingTarget === target.key) continue;
      syncIkTargetObject(
        ikTargetObjectsRef.current,
        target.key,
        target.position,
        draggingTarget,
      );
    }
    for (const poleTarget of createIkPoleTargetsFromPose(ikRig)) {
      if (
        draggingTarget === poleTarget.key ||
        poleTarget.effectorKey !== selectedEffectorKey
      ) {
        continue;
      }
      syncIkTargetObject(
        ikTargetObjectsRef.current,
        poleTarget.key,
        poleTarget.position,
        draggingTarget,
      );
    }
    if (ikDebugRef) {
      const targetPositions = new Map<IkEditableTargetKey, THREE.Vector3>();
      ikTargetObjectsRef.current.forEach((targetObject, key) => {
        targetPositions.set(key, targetObject.position.clone());
      });
      ikDebugRef.current = createIkDebugSnapshot(ikRig, {
        selectedTargetKey: selectedIkTargetKey ?? null,
        selectedEffectorKey: selectedEffectorKey ?? null,
        draggingTargetKey: draggingTarget,
        targetPositions,
        lastSolveResult: lastIkSolveResultRef.current,
      });
    }
  });

  const solveSelectedIkTarget = () => {
    if (!selectedIkTargetKey) return;
    const effectorKey = isIkPoleTargetKey(selectedIkTargetKey)
      ? IK_POLE_TARGET_EFFECTORS[selectedIkTargetKey]
      : selectedIkTargetKey;
    const chain = ikRig.chains.get(effectorKey);
    if (!chain?.available) return;

    const targetObject = ikTargetObjectsRef.current.get(effectorKey);
    if (!targetObject) return;
    if (!isFiniteVector(targetObject.position)) {
      const fallbackTarget = createIkTargetsFromPose(ikRig).find(
        (target) => target.key === effectorKey,
      );
      if (!fallbackTarget || !isFiniteVector(fallbackTarget.position)) return;
      targetObject.position.copy(fallbackTarget.position);
      targetObject.updateMatrixWorld(true);
    }
    const poleTarget =
      chain.poleKey && ikTargetObjectsRef.current.has(chain.poleKey)
        ? (() => {
            const poleObject = ikTargetObjectsRef.current.get(chain.poleKey);
            if (!poleObject) return undefined;
            if (!isFiniteVector(poleObject.position)) {
              const fallbackPole = createIkPoleTargetsFromPose(ikRig).find(
                (target) => target.key === chain.poleKey,
              );
              if (fallbackPole && isFiniteVector(fallbackPole.position)) {
                poleObject.position.copy(fallbackPole.position);
                poleObject.updateMatrixWorld(true);
              }
            }
            return {
              key: chain.poleKey,
              effectorKey,
              label: `${chain.label} pole`,
              position: poleObject.position.clone(),
            };
          })()
        : undefined;
    const result = solveFullBodyIk(
      ikRig,
      [
        {
          key: effectorKey,
          label: chain.label,
          position: targetObject.position.clone(),
        },
      ],
      {
        poleTargets: poleTarget ? [poleTarget] : undefined,
      },
    );
    lastIkSolveResultRef.current = result;
    const clampedTarget = result.clampedTargets[effectorKey];
    if (clampedTarget) {
      targetObject.position.copy(clampedTarget);
      targetObject.updateMatrixWorld(true);
    }
    const overrides = bakeIkResultToOverrides(
      ikRig,
      result.affectedBoneKeys,
      frameOverrides,
    );
    if (ikDebugRef) {
      const targetPositions = new Map<IkEditableTargetKey, THREE.Vector3>();
      ikTargetObjectsRef.current.forEach((targetObject, key) => {
        targetPositions.set(key, targetObject.position.clone());
      });
      ikDebugRef.current = createIkDebugSnapshot(ikRig, {
        selectedTargetKey: selectedIkTargetKey,
        selectedEffectorKey: effectorKey,
        draggingTargetKey: draggingIkTargetRef.current,
        targetPositions,
        lastSolveResult: result,
      });
    }
    onIkSolveChange?.(overrides, result);
  };

  return (
    <>
      {showSkeleton && <PoseSkeletonHelper object={object} />}
      {showHandles &&
        editMode === "fk" &&
        entries.map(({ key, bone }) => (
          <BoneHandle
            key={key}
            boneKey={key}
            bone={bone}
            selected={selectedBoneKey === key}
            edited={editedBoneKeys.includes(key)}
            onSelectBone={onSelectBone}
          />
        ))}
      {showHandles &&
        editMode === "ik" &&
        createIkTargetsFromPose(ikRig).map((target) => {
          return (
            <IkHandle
              key={target.key}
              targetKey={target.key}
              position={target.position}
              label={target.label}
              selected={selectedIkTargetKey === target.key}
              onObjectReady={registerIkTargetObject}
              onSelect={() => onSelectIkTarget?.(target.key)}
            />
          );
        })}
      {showHandles &&
        editMode === "ik" &&
        createIkPoleTargetsFromPose(ikRig)
          .filter((target) => target.effectorKey === selectedEffectorKey)
          .map((target) => {
            return (
              <IkHandle
                key={target.key}
                targetKey={target.key}
                position={target.position}
                label={target.label}
                selected={selectedIkTargetKey === target.key}
                pole
                onObjectReady={registerIkTargetObject}
                onSelect={() => onSelectIkTarget?.(target.key)}
              />
            );
          })}
      {gizmoEnabled && editMode === "fk" && selectedBone && selectedBoneKey && (
        <TransformControls
          object={selectedBone}
          mode={transformMode}
          space="local"
          size={0.65}
          onMouseDown={onGizmoEditStart}
          onMouseUp={onGizmoEditEnd}
          onObjectChange={() => {
            onBoneEulerChange?.(
              selectedBoneKey,
              quaternionToEulerDeg(selectedBone.quaternion),
            );
            if (transformMode === "translate") {
              onBonePositionChange?.(
                selectedBoneKey,
                vectorToPositionOverride(selectedBone.position),
              );
            }
          }}
        />
      )}
      {gizmoEnabled &&
        editMode === "ik" &&
        selectedIkObject &&
        selectedIkChainAvailable && (
        <TransformControls
          object={selectedIkObject}
          mode="translate"
          space="world"
          size={0.72}
          onMouseDown={() => {
            draggingIkTargetRef.current = selectedIkTargetKey ?? null;
            onGizmoEditStart?.();
          }}
          onMouseUp={() => {
            draggingIkTargetRef.current = null;
            onGizmoEditEnd?.();
          }}
          onObjectChange={solveSelectedIkTarget}
        />
      )}
    </>
  );
}

interface Props {
  modelUuid: string;
  landmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  visibilityLandmarksRef?: React.RefObject<NormalizedLandmark[] | null>;
  remap: BoneRemap;
  poseDataRef?: React.RefObject<PoseBoneData | null>;
  staticPoseRef?: React.RefObject<PoseBoneData | null>;
  rootMotion?: boolean;
  landmarkSmoothing?: boolean;
  calibrationRef?: React.RefObject<PoseCalibration | null>;
  calibrationRequestId?: number;
  onCalibrationReady?: (calibration: PoseCalibration) => void;
  editMode?: "fk" | "ik";
  transformMode?: "rotate" | "translate";
  selectedBoneKey?: string | null;
  selectedIkTargetKey?: IkEditableTargetKey | null;
  frameOverrides?: PoseFrameOverrides;
  onSelectBone?: (boneKey: string) => void;
  onSelectIkTarget?: (targetKey: IkEditableTargetKey) => void;
  onBoneEulerChange?: (boneKey: string, euler: PoseBoneOverride) => void;
  onBonePositionChange?: (
    boneKey: string,
    position: NonNullable<PoseBoneOverride["position"]>,
  ) => void;
  onIkSolveChange?: (
    overrides: PoseFrameOverrides,
    result: IkSolveResult,
  ) => void;
  onIkStatusChange?: (status: IkAvailability) => void;
  ikDebugRef?: React.MutableRefObject<IkDebugSnapshot | null>;
  onGizmoEditStart?: () => void;
  onGizmoEditEnd?: () => void;
  showSkeleton?: boolean;
  showHandles?: boolean;
  gizmoEnabled?: boolean;
  editedBoneKeys?: readonly string[];
}

export function ModelPreview({
  modelUuid,
  landmarksRef,
  visibilityLandmarksRef,
  remap,
  poseDataRef,
  staticPoseRef,
  rootMotion,
  landmarkSmoothing,
  calibrationRef,
  calibrationRequestId,
  onCalibrationReady,
  editMode,
  transformMode,
  selectedBoneKey,
  selectedIkTargetKey,
  frameOverrides,
  onSelectBone,
  onSelectIkTarget,
  onBoneEulerChange,
  onBonePositionChange,
  onIkSolveChange,
  onIkStatusChange,
  ikDebugRef,
  onGizmoEditStart,
  onGizmoEditEnd,
  showSkeleton,
  showHandles,
  gizmoEnabled,
  editedBoneKeys,
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
        visibilityLandmarksRef={visibilityLandmarksRef}
        remap={remap}
        poseDataRef={poseDataRef}
        calibrationRef={calibrationRef}
        calibrationRequestId={calibrationRequestId}
        onCalibrationReady={onCalibrationReady}
        staticPoseRef={staticPoseRef}
        rootMotion={rootMotion}
        landmarkSmoothing={landmarkSmoothing}
        modelScale={modelScale}
      />
      {staticPoseRef && (
        <PoseEditLayer
          object={object}
          remap={remap}
          editMode={editMode}
          transformMode={transformMode}
          selectedBoneKey={selectedBoneKey}
          selectedIkTargetKey={selectedIkTargetKey}
          frameOverrides={frameOverrides}
          onSelectBone={onSelectBone}
          onSelectIkTarget={onSelectIkTarget}
          onBoneEulerChange={onBoneEulerChange}
          onBonePositionChange={onBonePositionChange}
          onIkSolveChange={onIkSolveChange}
          onIkStatusChange={onIkStatusChange}
          ikDebugRef={ikDebugRef}
          onGizmoEditStart={onGizmoEditStart}
          onGizmoEditEnd={onGizmoEditEnd}
          showSkeleton={showSkeleton}
          showHandles={showHandles}
          gizmoEnabled={gizmoEnabled}
          editedBoneKeys={editedBoneKeys}
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
