import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import type { BoneRemap } from "./bone-remap";
import type {
  BoneFrame,
  JointPositions,
  PoseBoneData,
} from "./mediapipe-to-bones";
import type { PoseFrame } from "./pose-to-animation";
import {
  applyRetargetedPose,
  scorePoseLandmarks,
  type PoseQualityResult,
  type RigRetargetBone,
  type RigRetargetMap,
} from "./pose-retargeting";

/**
 * Landmarks -> posed rig, as a pure function.
 *
 * This logic used to live inside `model-preview.tsx`'s `useFrame` callback,
 * which made it impossible to run without React, R3F and a render loop - so it
 * could not be unit tested and could not be measured headlessly over a video.
 * Extracted verbatim so the live preview, the recorder and any offline
 * benchmark all drive the rig through exactly the same code, which is the
 * point: a benchmark that re-implements the solve measures the benchmark.
 *
 * The rig is mutated in place. Callers own the persistent state (the smoother,
 * the hold map, the root-motion reference) so a benchmark can run a clip
 * deterministically from a clean start.
 */

/** MediaPipe landmark indices used for visibility gating. */
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * Minimum landmark visibility to drive a bone. Below this the bone holds its
 * last good rotation rather than following a guess - a held joint is stale,
 * but a guessed one is wrong.
 */
export const VIS_THRESHOLD = 0.5;

const BONE_VISIBILITY_LANDMARKS: Partial<
  Record<keyof BoneRemap, readonly number[]>
> = {
  leftShoulder: [LM.LEFT_SHOULDER],
  rightShoulder: [LM.RIGHT_SHOULDER],
  leftArm: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  rightArm: [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  leftForeArm: [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  rightForeArm: [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  leftUpLeg: [LM.LEFT_HIP, LM.LEFT_KNEE],
  rightUpLeg: [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  leftLeg: [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  rightLeg: [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  leftFoot: [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
  rightFoot: [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
  neck: [
    LM.LEFT_EAR,
    LM.RIGHT_EAR,
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
  ],
  head: [
    LM.LEFT_EAR,
    LM.RIGHT_EAR,
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
  ],
};

/** Bone keys whose required landmarks are below the solve's visibility gate. */
export function getHeldPoseBoneKeys(
  landmarks: readonly NormalizedLandmark[],
  threshold = VIS_THRESHOLD,
): (keyof BoneRemap)[] {
  return (Object.entries(BONE_VISIBILITY_LANDMARKS) as [
    keyof BoneRemap,
    readonly number[],
  ][])
    .filter(([, indices]) =>
      indices.some(
        (index) => (landmarks[index]?.visibility ?? 1) < threshold,
      ),
    )
    .map(([key]) => key);
}

/** Quality above which a held bone keeps its full last-good rotation. */
const HOLD_FULL_QUALITY = 0.52;

export interface RootMotionState {
  /** Hip-to-floor distance on the first solved frame, in landmark metres. */
  restHipToFloor: number | null;
  /** The hips bone's rest position, in rig units. */
  hipRestPosition: THREE.Vector3 | null;
}

export function createRootMotionState(): RootMotionState {
  return { restHipToFloor: null, hipRestPosition: null };
}

export interface SolvePoseParams {
  /** The rig root, so world matrices can be refreshed between chain levels. */
  object: THREE.Object3D;
  rigMap: RigRetargetMap;
  /** Raw landmarks, used only for visibility gating and quality scoring. */
  landmarks: NormalizedLandmark[];
  /**
   * Landmarks carrying detector confidence. MediaPipe normally reports
   * visibility on its screen-space result, not on `worldLandmarks`.
   */
  visibilityLandmarks?: NormalizedLandmark[];
  /** Joint positions, already smoothed by the caller. */
  joints: JointPositions;
  /** Per-bone last-good rotations, owned and reused by the caller. */
  hold: Map<string, THREE.Quaternion>;
  /** Vertical root motion state, owned and reused by the caller. */
  rootMotionState: RootMotionState;
  rootMotion?: boolean;
  /** Landmark metres -> rig units. */
  modelScale?: number;
  /**
   * Full root translation for this frame, in RIG UNITS, relative to the hips'
   * rest position. Supply this when translation has been recovered from the
   * screen landmarks (see `pose-root-motion.ts`); it replaces the vertical-only
   * estimate below, which is all the world landmarks can offer.
   */
  rootTranslation?: THREE.Vector3;
  /** Precomputed quality; recomputed from `landmarks` when omitted. */
  quality?: PoseQualityResult;
  /**
   * Minimum landmark visibility to drive a bone. Defaults to VIS_THRESHOLD.
   *
   * Worth lowering when a limb is occluded for a WHOLE clip - a profile shot
   * occludes the far arm in every single frame, so at the default the arm is
   * never driven and freezes in the rig's rest pose. On a Mixamo rig that rest
   * pose is a T-pose, so the character walks with an arm sticking straight
   * out. MediaPipe still emits a temporally tracked estimate for an occluded
   * limb; using it is less of a fabrication than asserting a horizontal arm.
   */
  visThreshold?: number;
  /**
   * Correction applied to the head/neck aim direction, in the TORSO's frame.
   *
   * Aiming the neck at the ear midpoint fixes most of the nose problem but not
   * all of it: shoulder-centre to ear-midpoint is ALREADY tilted forward in a
   * perfectly neutral pose, because the ears sit forward of the spine axis.
   * Declaring the rig's rest to be "straight up" therefore still books that
   * residual anatomical offset as head-down rotation - measured at 46.5 degrees
   * after the ear fix, against a walker's near-zero.
   *
   * `solveHeadAimCorrection` derives this from the clip's own median carriage,
   * so the bone expresses DEVIATION FROM THE PERFORMER'S HABITUAL POSTURE. The
   * trade-off is explicit: someone who walks with a permanently bowed head is
   * rendered with a level one.
   */
  headAimCorrection?: THREE.Quaternion;
  /**
   * How much the shoulder line contributes to the body's across-axis, relative
   * to the hip line. Defaults to 0 - the hip line alone, unchanged behaviour.
   * See `solveAcrossAxis` for what the trade actually costs.
   */
  shoulderAcrossWeight?: number;
  /**
   * True hip width in landmark metres, e.g. `leftHipHalf + rightHipHalf` from a
   * fixed skeleton. Supplied, the across-axis has its compressed depth
   * component restored to this length before orienting the hips.
   */
  hipWidth?: number;
}

/**
 * The body's across-axis (the performer's left-to-right direction).
 *
 * PLAN-mediapipe-mocap.md, finding 5: taking this from the hip line alone is
 * fragile in a profile shot, because the hip line then points nearly along the
 * camera's view direction - exactly where monocular depth is weakest. Measured
 * on the reference clip the hip and shoulder lines disagreed by 12.6 degrees on
 * average and up to 22.4, and shoulder width came out 0.26 m against a real
 * ~0.38 m, both symptoms of depth compression.
 *
 * The shoulder line is a second, independent measurement of the same axis. It
 * is NOT the same axis anatomically - the pelvis and thorax counter-rotate
 * during gait, by roughly the amount observed - so blending the two damps real
 * torsion in exchange for noise. `shoulderWeight` sets that trade explicitly;
 * at 0 this is the old hip-only behaviour exactly.
 *
 * Each line is weighted by the visibility of its own two landmarks, so an
 * occluded pair stops contributing rather than voting with a guess.
 */
export function solveAcrossAxis(
  j: JointPositions,
  weights: { hip?: number; shoulder?: number } = {},
  shoulderWeight = 0.5,
): THREE.Vector3 {
  const hipDir = j.rightHip.clone().sub(j.leftHip);
  const shoulderDir = j.rightShoulder.clone().sub(j.leftShoulder);
  const hipLen = hipDir.length();
  const shoulderLen = shoulderDir.length();

  if (hipLen < 1e-9) {
    return shoulderLen < 1e-9
      ? new THREE.Vector3(1, 0, 0)
      : shoulderDir.divideScalar(shoulderLen);
  }
  hipDir.divideScalar(hipLen);
  if (shoulderLen < 1e-9 || shoulderWeight <= 0) return hipDir;
  shoulderDir.divideScalar(shoulderLen);

  // A shoulder line pointing the opposite way to the hips means the torso is
  // twisted past 90 degrees or one of the two is simply wrong. Averaging them
  // would cancel to near zero and yield a meaningless axis, so the hips - which
  // are what this quaternion actually drives - win outright.
  if (hipDir.dot(shoulderDir) <= 0) return hipDir;

  const wHip = weights.hip ?? 1;
  const wShoulder = (weights.shoulder ?? 1) * shoulderWeight;
  const blended = hipDir
    .clone()
    .multiplyScalar(wHip)
    .addScaledVector(shoulderDir, wShoulder);
  return blended.lengthSq() < 1e-12 ? hipDir : blended.normalize();
}

/**
 * Restore the depth component of a body axis to a known length.
 *
 * PLAN-mediapipe-mocap.md, finding 5, second half: the hip line measured 0.26 m
 * across where a real pelvis is ~0.38 m. A monocular estimator compresses the
 * component along the view direction, so a body axis pointing at the camera -
 * exactly what the hip line does in a profile shot - comes back too SHORT, with
 * the shortfall entirely in depth.
 *
 * Given the true length, the missing depth follows from Pythagoras. Restoring
 * it swings the axis away from the image plane, which is where it actually is,
 * and that matters because an axis pinned near the image plane turns small
 * in-plane noise into large apparent yaw.
 *
 * The SIGN of the depth is not recoverable this way - it is the classic
 * monocular front/back ambiguity - so the observed sign is kept. Landmark
 * smoothing upstream is what keeps that sign from flickering.
 *
 * @param v The observed axis, with z as the camera depth direction.
 * @param targetLength The axis's true length, e.g. from a fixed skeleton.
 */
export function restoreAxisDepth(v: THREE.Vector3, targetLength: number): THREE.Vector3 {
  if (!(targetLength > 0)) return v.clone();
  const inPlane = Math.hypot(v.x, v.y);
  // Already at or past the target: nothing is missing, and inventing depth to
  // pad a length that is too LONG would be fabrication rather than correction.
  if (inPlane >= targetLength) return v.clone();
  const depth = Math.sqrt(targetLength * targetLength - inPlane * inPlane);
  // Only ever ADD depth. A target shorter than what was observed says the
  // target is wrong, not that the observation should be shrunk - and shrinking
  // it swings the axis toward the image plane, which is the failure mode this
  // function exists to correct. Measured with a rig-derived target of 11.2 cm
  // against a 22.7 cm observation, the missing guard drove pelvic yaw from 18
  // degrees peak-to-peak to 46.6.
  if (depth <= Math.abs(v.z)) return v.clone();
  return new THREE.Vector3(v.x, v.y, v.z < 0 ? -depth : depth);
}

/**
 * Orient the hips from the body's own frame.
 *
 * @param across Optional across-axis, from `solveAcrossAxis`. Omitted, the hip
 *   line alone is used - the historical behaviour.
 */
export function applyHips(
  hipsData: RigRetargetBone,
  j: JointPositions,
  across?: THREE.Vector3,
): void {
  const { bone } = hipsData;

  bone.quaternion.copy(hipsData.restQuat);

  // With Y-up worldLandmarks and -p.x: rightHip is +X, up is +Y, cross(+X,+Y) = +Z.
  // lookAt(origin, +Z, +Y) makes the matrix's -Z axis point toward +Z → character faces camera.
  const right = across
    ? across.clone().normalize()
    : j.rightHip.clone().sub(j.leftHip).normalize();
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

/** Read the rig's current local transforms back out as a pose. */
export function buildPoseDataFromRig(
  rigMap: RigRetargetMap,
  rootMotion?: boolean,
): PoseBoneData {
  const hipsData = rigMap.bones.get("hips");
  const bones: BoneFrame[] = [];

  rigMap.bones.forEach((boneData, key) => {
    if (key === "hips") return;
    bones.push({
      boneKey: key,
      boneName: boneData.boneName,
      position: boneData.bone.position.clone(),
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

/** Write a pose back onto the rig. */
export function applyPoseDataToRig(
  rigMap: RigRetargetMap,
  pose: PoseBoneData,
  applyHipsPosition = true,
): void {
  const hipsData = rigMap.bones.get("hips");
  if (hipsData) {
    hipsData.bone.quaternion.copy(pose.hips.quaternion);
    if (applyHipsPosition) hipsData.bone.position.copy(pose.hips.position);
    hipsData.bone.updateMatrix();
  }

  for (const frame of pose.bones) {
    const boneData = rigMap.bones.get(frame.boneKey);
    if (!boneData) continue;
    if (frame.position) boneData.bone.position.copy(frame.position);
    boneData.bone.quaternion.copy(frame.quaternion);
    boneData.bone.updateMatrix();
  }
}

/**
 * Convert a delta expressed in WORLD units into the bone's own local space.
 *
 * Bone positions are local, and a bone's parent chain may carry rotation and
 * scale. Writing a world-space delta straight into `bone.position` silently
 * scales it by whatever the parents do. That is not hypothetical: a Mixamo
 * FBX->GLB export parents the hips under an "Armature" node scaled to 0.01 to
 * convert the original centimetres to metres, so a world delta written locally
 * comes out ONE HUNDRED TIMES too small. Measured on the reference rig, the
 * hips travelled 0.032 units where 3.35 were intended.
 */
export function worldDeltaToLocal(
  bone: THREE.Object3D,
  worldDelta: THREE.Vector3,
): THREE.Vector3 {
  const parent = bone.parent;
  if (!parent) return worldDelta.clone();

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  parent.updateWorldMatrix(true, false);
  parent.matrixWorld.decompose(position, quaternion, scale);

  const local = worldDelta.clone().applyQuaternion(quaternion.invert());
  // Guard against a degenerate axis rather than emitting Infinity.
  local.x /= Math.abs(scale.x) > 1e-9 ? scale.x : 1;
  local.y /= Math.abs(scale.y) > 1e-9 ? scale.y : 1;
  local.z /= Math.abs(scale.z) > 1e-9 ? scale.z : 1;
  return local;
}

/** Reset every mapped bone to its rest transform, so rotations never accumulate. */
export function resetRigToRest(rigMap: RigRetargetMap): void {
  rigMap.bones.forEach(({ bone, restPosition, restQuat }) => {
    bone.position.copy(restPosition);
    bone.quaternion.copy(restQuat);
    bone.updateMatrix();
  });
}

export interface SolvePoseResult {
  /** The rig's local transforms after solving, before calibration or clamping. */
  pose: PoseBoneData;
  quality: PoseQualityResult;
  /** Bones that held a previous rotation because visibility was too low. */
  heldBones: (keyof BoneRemap)[];
}

/**
 * Drive the rig from one frame of landmarks.
 *
 * Order matters: bones are applied root-first, because `applyRetargetedPose`
 * reads the parent's world rotation to convert a world direction into a
 * parent-local one. Every mapped bone is reset to rest first so nothing
 * accumulates across frames.
 */
export function solvePoseOntoRig(params: SolvePoseParams): SolvePoseResult {
  const {
    object,
    rigMap,
    landmarks,
    joints: j,
    hold,
    rootMotionState,
    rootMotion,
    modelScale = 1,
    rootTranslation,
  } = params;

  const visibilityLandmarks = params.visibilityLandmarks ?? landmarks;
  const quality =
    params.quality ??
    scorePoseLandmarks({
      worldLandmarks: landmarks,
      screenLandmarks: visibilityLandmarks,
    });
  const heldBones: (keyof BoneRemap)[] = [];

  const threshold = params.visThreshold ?? VIS_THRESHOLD;
  const heldByVisibility = new Set(
    getHeldPoseBoneKeys(visibilityLandmarks, threshold),
  );
  const boneVisible = (key: keyof BoneRemap) => !heldByVisibility.has(key);
  const get = (key: keyof BoneRemap) => rigMap.bones.get(key);

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
      heldBones.push(key);
      const saved = hold.get(key);
      if (saved && quality.score >= HOLD_FULL_QUALITY) {
        bd.bone.quaternion.copy(saved);
      } else if (saved) {
        // Poor overall quality: ease back toward rest rather than trusting a
        // stale rotation outright.
        bd.bone.quaternion
          .copy(bd.restQuat)
          .slerp(saved, Math.max(0.1, quality.score * 0.5));
      } else {
        bd.bone.quaternion.copy(bd.restQuat);
      }
    }
    bd.bone.updateMatrix();
  };

  resetRigToRest(rigMap);

  const hipsData = get("hips");
  if (hipsData) {
    const shoulderAcrossWeight = params.shoulderAcrossWeight ?? 0;
    const across =
      shoulderAcrossWeight > 0
        ? solveAcrossAxis(
            j,
            {
              hip: Math.min(
                visibilityLandmarks[LM.LEFT_HIP]?.visibility ?? 1,
                visibilityLandmarks[LM.RIGHT_HIP]?.visibility ?? 1,
              ),
              shoulder: Math.min(
                visibilityLandmarks[LM.LEFT_SHOULDER]?.visibility ?? 1,
                visibilityLandmarks[LM.RIGHT_SHOULDER]?.visibility ?? 1,
              ),
            },
            shoulderAcrossWeight,
          )
        : undefined;
    const corrected =
      params.hipWidth && params.hipWidth > 0
        ? restoreAxisDepth(
            across ?? j.rightHip.clone().sub(j.leftHip),
            params.hipWidth,
          )
        : across;
    applyHips(hipsData, j, corrected);

    if (rootMotion) {
      if (rootMotionState.hipRestPosition === null) {
        rootMotionState.hipRestPosition = hipsData.bone.position.clone();
      }

      if (rootTranslation) {
        // Recovered from the screen landmarks, which unlike the world
        // landmarks do contain global motion. The delta arrives in world units
        // and must be taken into the hips' own local space first.
        hipsData.bone.position
          .copy(rootMotionState.hipRestPosition)
          .add(worldDeltaToLocal(hipsData.bone, rootTranslation));
      } else {
        // Fallback: vertical only. Hip height above foot level changes when
        // crouching, jumping or sitting, and is the ONLY root motion the world
        // landmarks can offer - they are hip-centred, so horizontal
        // translation is identically zero in them.
        const hipToFloor = j.hipCenter.y - (j.leftAnkle.y + j.rightAnkle.y) * 0.5;
        if (rootMotionState.restHipToFloor === null) {
          rootMotionState.restHipToFloor = hipToFloor;
        }
        // Landmark metres -> world units, then into the hips' local space. The
        // second step is what the previous version omitted, which made this
        // motion 100x too small on any rig with a scaled parent.
        const worldDeltaY = (hipToFloor - rootMotionState.restHipToFloor) / modelScale;
        const localDelta = worldDeltaToLocal(
          hipsData.bone,
          new THREE.Vector3(0, worldDeltaY, 0),
        );
        hipsData.bone.position.copy(rootMotionState.hipRestPosition).add(localDelta);
      }
      hipsData.bone.updateMatrix();
    }
  }

  // Spine chain — always driven, since it is derived from hips + shoulders.
  const spineOrigin = j.hipCenter.clone();
  const spineEnd = j.shoulderCenter.clone();
  const spineMid = spineOrigin.clone().lerp(spineEnd, 0.5);

  const spineData = get("spine");
  if (spineData) applyRetargetedPose(spineData, spineOrigin, spineMid);
  const spine1Data = get("spine1");
  if (spine1Data) applyRetargetedPose(spine1Data, spineOrigin, spineMid);
  const spine2Data = get("spine2");
  if (spine2Data) applyRetargetedPose(spine2Data, spineMid, spineEnd);

  // Clavicles
  drive("leftShoulder", boneVisible("leftShoulder"), j.shoulderCenter, j.leftShoulder);
  drive("rightShoulder", boneVisible("rightShoulder"), j.shoulderCenter, j.rightShoulder);

  // Arms
  drive("leftArm", boneVisible("leftArm"), j.leftShoulder, j.leftElbow);
  drive("rightArm", boneVisible("rightArm"), j.rightShoulder, j.rightElbow);

  // Forearms
  drive("leftForeArm", boneVisible("leftForeArm"), j.leftElbow, j.leftWrist);
  drive("rightForeArm", boneVisible("rightForeArm"), j.rightElbow, j.rightWrist);

  // Legs
  drive("leftUpLeg", boneVisible("leftUpLeg"), j.leftHip, j.leftKnee);
  drive("rightUpLeg", boneVisible("rightUpLeg"), j.rightHip, j.rightKnee);
  drive("leftLeg", boneVisible("leftLeg"), j.leftKnee, j.leftAnkle);
  drive("rightLeg", boneVisible("rightLeg"), j.rightKnee, j.rightAnkle);

  // Feet, aimed HEEL -> TOE rather than ankle -> toe.
  //
  // The ankle is a joint; the heel and toe are both on the rigid foot, so the
  // heel-to-toe vector is the foot's actual axis. Aiming from the ankle mixes
  // that joint's own position error into the foot's angle, and MediaPipe's
  // ankle is among its noisier landmarks. Measured on one frame of the
  // reference clip, ankle-to-toe gave a right-foot direction of
  // (-0.77, +0.12, -0.62) - a foot pointing UP and BACKWARD, which is
  // anatomically impossible mid-stride and showed up as visibly flapping feet.
  drive(
    "leftFoot",
    boneVisible("leftFoot"),
    j.leftHeel,
    j.leftFootIndex,
  );
  drive(
    "rightFoot",
    boneVisible("rightFoot"),
    j.rightHeel,
    j.rightFootIndex,
  );

  // Neck / head, aimed at the EAR MIDPOINT rather than the nose.
  //
  // The nose sits well forward of the head's axis, so aiming a bone whose rest
  // direction is "straight up" at the nose books that fixed anatomical offset
  // as head-down rotation. Measured on the reference clip it produced 56.4
  // degrees of neck-to-head lean, against a walker's near-zero, and the
  // character rendered visibly hunched. The ear midpoint sits close to the
  // atlanto-occipital joint and tracks head orientation far better.
  const headVisible = boneVisible("head");
  let headTarget = j.earCenter;
  if (params.headAimCorrection) {
    // Correct in the torso's frame, so the performer's overall lean and turn
    // do not leak into what is meant to be a local anatomical offset.
    const across = j.rightHip.clone().sub(j.leftHip).normalize();
    const up = j.shoulderCenter.clone().sub(j.hipCenter).normalize();
    const forward = new THREE.Vector3().crossVectors(across, up).normalize();
    const torso = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(across, up, forward),
    );
    const dir = j.earCenter.clone().sub(j.shoulderCenter);
    const length = dir.length();
    if (length > 1e-6) {
      dir.normalize()
        .applyQuaternion(torso.clone().invert())
        .applyQuaternion(params.headAimCorrection)
        .applyQuaternion(torso);
      headTarget = j.shoulderCenter.clone().addScaledVector(dir, length);
    }
  }
  drive("neck", headVisible, j.shoulderCenter, headTarget);
  drive("head", headVisible, j.shoulderCenter, headTarget);

  object.updateMatrixWorld(true);

  return {
    pose: buildPoseDataFromRig(rigMap, rootMotion),
    quality,
    heldBones,
  };
}

/**
 * Rotate a whole clip about world Y so the character faces the rig's rest
 * forward.
 *
 * Monocular recovery happens in CAMERA space, so which way the character ends
 * up facing is an accident of how the shot was framed: a performer walking
 * across frame comes out facing sideways relative to the rig. Sprite Sheet
 * Helper's workflow cameras assume the character faces the rig's forward axis,
 * so without this the sprites are shot from the wrong side.
 *
 * This was learned the hard way: in the EasyMocap experiment every automated
 * check passed on a sheet that was visibly shot at a useless three-quarter
 * angle, and only rendering the PNG revealed it.
 *
 * A rigid rotation. It changes nothing about the pose, only where it points.
 *
 * @param restForward The rig's facing direction in its rest pose, on the
 *   ground plane. Humanoid rigs conventionally face +Z.
 */
export function canonicaliseFacing(
  frames: PoseFrame[],
  hipsParentWorldQuat: THREE.Quaternion,
  restForward: THREE.Vector3 = new THREE.Vector3(0, 0, 1),
): { frames: PoseFrame[]; degrees: number } {
  if (frames.length === 0) return { frames, degrees: 0 };

  const target = new THREE.Vector3(restForward.x, 0, restForward.z);
  if (target.lengthSq() < 1e-12) return { frames, degrees: 0 };
  target.normalize();

  // Mean facing across the clip, summed as DIRECTIONS so the wrap-around at
  // +-180 degrees cannot corrupt the average.
  const sum = new THREE.Vector3();
  const world = new THREE.Quaternion();
  const facing = new THREE.Vector3();
  for (const frame of frames) {
    world.copy(hipsParentWorldQuat).multiply(frame.data.hips.quaternion);
    facing.copy(restForward).applyQuaternion(world);
    facing.y = 0;
    if (facing.lengthSq() < 1e-12) continue;
    sum.add(facing.normalize());
  }
  if (sum.lengthSq() < 1e-6) {
    // The performer turns through a full circle, or faces the camera head on.
    // Rotating to an arbitrary "mean" would be worse than leaving it alone.
    return { frames, degrees: 0 };
  }
  sum.normalize();

  const angle = Math.atan2(
    sum.z * target.x - sum.x * target.z,
    sum.x * target.x + sum.z * target.z,
  );
  const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);

  // The hips quaternion is PARENT-LOCAL, so a world-space spin has to be taken
  // through the parent's frame: local' = parentWorld^-1 * spin * parentWorld * local.
  const parentInverse = hipsParentWorldQuat.clone().invert();
  const localSpin = parentInverse.clone().multiply(spin).multiply(hipsParentWorldQuat);

  const rotated = frames.map((frame) => ({
    time: frame.time,
    data: {
      hips: {
        boneName: frame.data.hips.boneName,
        position: frame.data.hips.position.clone().applyQuaternion(localSpin),
        quaternion: localSpin.clone().multiply(frame.data.hips.quaternion),
      },
      bones: frame.data.bones.map((bone) => ({ ...bone })),
    },
  }));

  return { frames: rotated, degrees: (angle * 180) / Math.PI };
}

/**
 * Solve the head-aim correction for a clip: the rotation taking the
 * performer's median head carriage onto the rig's "straight up" rest.
 *
 * Measured in the TORSO's own frame and averaged as DIRECTIONS, so neither the
 * performer's overall lean nor the wrap-around at +-180 degrees can corrupt it.
 */
export function solveHeadAimCorrection(
  samples: { shoulderCenter: THREE.Vector3; hipCenter: THREE.Vector3; leftHip: THREE.Vector3; rightHip: THREE.Vector3; earCenter: THREE.Vector3 }[],
): THREE.Quaternion {
  const sum = new THREE.Vector3();
  for (const s of samples) {
    const across = s.rightHip.clone().sub(s.leftHip).normalize();
    const up = s.shoulderCenter.clone().sub(s.hipCenter).normalize();
    const forward = new THREE.Vector3().crossVectors(across, up).normalize();
    const torso = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(across, up, forward),
    );
    const dir = s.earCenter.clone().sub(s.shoulderCenter);
    if (dir.lengthSq() < 1e-12) continue;
    sum.add(dir.normalize().applyQuaternion(torso.invert()));
  }
  if (sum.lengthSq() < 1e-9) return new THREE.Quaternion();
  // Rotate the median carriage onto the rig's rest direction, which is up.
  return new THREE.Quaternion().setFromUnitVectors(
    sum.normalize(),
    new THREE.Vector3(0, 1, 0),
  );
}
