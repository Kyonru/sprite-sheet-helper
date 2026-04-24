import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { BoneRemap } from "./bone-remap";

// ── MediaPipe landmark indices ─────────────────────────────────────────────
const IDX = {
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
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

// ── Joint positions (converted to Three.js Y-up space) ───────────────────────
export interface JointPositions {
  leftShoulder: THREE.Vector3;
  rightShoulder: THREE.Vector3;
  leftElbow: THREE.Vector3;
  rightElbow: THREE.Vector3;
  leftWrist: THREE.Vector3;
  rightWrist: THREE.Vector3;
  leftHip: THREE.Vector3;
  rightHip: THREE.Vector3;
  leftKnee: THREE.Vector3;
  rightKnee: THREE.Vector3;
  leftAnkle: THREE.Vector3;
  rightAnkle: THREE.Vector3;
  leftHeel: THREE.Vector3;
  rightHeel: THREE.Vector3;
  leftFootIndex: THREE.Vector3;
  rightFootIndex: THREE.Vector3;
  nose: THREE.Vector3;
  hipCenter: THREE.Vector3;
  shoulderCenter: THREE.Vector3;
}

function toLH(p: NormalizedLandmark): THREE.Vector3 {
  // worldLandmarks: X = camera-right (negate so character's left = -X when facing +Z),
  // Y = image-down (negate for Three.js Y-up), Z = positive toward camera (keep as-is).
  return new THREE.Vector3(-p.x, -p.y, p.z);
}

export function landmarksToJointPositions(
  lm: NormalizedLandmark[],
): JointPositions {
  const ls = toLH(lm[IDX.LEFT_SHOULDER]);
  const rs = toLH(lm[IDX.RIGHT_SHOULDER]);
  const lh = toLH(lm[IDX.LEFT_HIP]);
  const rh = toLH(lm[IDX.RIGHT_HIP]);
  return {
    leftShoulder: ls,
    rightShoulder: rs,
    leftElbow: toLH(lm[IDX.LEFT_ELBOW]),
    rightElbow: toLH(lm[IDX.RIGHT_ELBOW]),
    leftWrist: toLH(lm[IDX.LEFT_WRIST]),
    rightWrist: toLH(lm[IDX.RIGHT_WRIST]),
    leftHip: lh,
    rightHip: rh,
    leftKnee: toLH(lm[IDX.LEFT_KNEE]),
    rightKnee: toLH(lm[IDX.RIGHT_KNEE]),
    leftAnkle: toLH(lm[IDX.LEFT_ANKLE]),
    rightAnkle: toLH(lm[IDX.RIGHT_ANKLE]),
    leftHeel: toLH(lm[IDX.LEFT_HEEL]),
    rightHeel: toLH(lm[IDX.RIGHT_HEEL]),
    leftFootIndex: toLH(lm[IDX.LEFT_FOOT_INDEX]),
    rightFootIndex: toLH(lm[IDX.RIGHT_FOOT_INDEX]),
    nose: toLH(lm[IDX.NOSE]),
    hipCenter: lh.clone().add(rh).multiplyScalar(0.5),
    shoulderCenter: ls.clone().add(rs).multiplyScalar(0.5),
  };
}

// ── Bone frame types (used by recording + animation clip creation) ─────────

export interface BoneFrame {
  boneKey: keyof BoneRemap;
  boneName: string;
  quaternion: THREE.Quaternion;
}

export interface HipsFrame {
  boneName: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export interface PoseBoneData {
  hips: HipsFrame;
  bones: BoneFrame[];
}

// Scratch objects to avoid GC pressure during recording
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();

/** Build a quaternion that rotates world +Y axis toward (to - from). */
function dirQuat(from: THREE.Vector3, to: THREE.Vector3): THREE.Quaternion {
  _v1.copy(to).sub(from);
  if (_v1.lengthSq() < 1e-8) return new THREE.Quaternion();
  _v1.normalize();

  // Choose an up reference that's not parallel to _v1
  _v2.set(0, 1, 0);
  if (Math.abs(_v1.dot(_v2)) > 0.99) _v2.set(0, 0, 1);

  // Build a look-at matrix pointing +Z = _v1, then rotate so +Y = _v1
  _v3.crossVectors(_v2, _v1).normalize();
  _v2.crossVectors(_v1, _v3).normalize();
  _m4.makeBasis(_v3, _v2, _v1);
  _q.setFromRotationMatrix(_m4);
  // Adjust: makeBasis gives forward=+Z, we want the bone's +Y to point toward child
  _q.multiply(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
  );
  return _q.clone();
}

/**
 * Compute approximate world-space bone quaternions from world landmarks.
 * Used for recording frames. These are stored in PoseFrame and later
 * baked into the AnimationClip.
 *
 * NOTE: For the live 3D preview, use applyPoseToSkeleton() in model-preview
 * which has access to actual bone objects and computes proper local rotations.
 */
export function landmarksToBones(
  lm: NormalizedLandmark[],
  remap?: BoneRemap,
): PoseBoneData {
  const j = landmarksToJointPositions(lm);

  const hipsPos = j.hipCenter.clone();

  // Hips orientation: right × up = forward
  const hipRight = _v1.copy(j.rightHip).sub(j.leftHip).normalize().clone();
  const hipUp = _v2.copy(j.shoulderCenter).sub(j.hipCenter).normalize().clone();
  const hipFwd = new THREE.Vector3().crossVectors(hipRight, hipUp).normalize();
  const hipsQuat = new THREE.Quaternion().setFromRotationMatrix(
    _m4.lookAt(new THREE.Vector3(), hipFwd, hipUp),
  );

  const spineDir = dirQuat(j.hipCenter, j.shoulderCenter);

  // Uniform names — callers pass a remap to override
  const R = remap;
  const n = (key: keyof BoneRemap) => R?.[key] ?? key;

  return {
    hips: { boneName: n("hips"), position: hipsPos, quaternion: hipsQuat },
    bones: [
      {
        boneKey: "spine",
        boneName: n("spine"),
        quaternion: spineDir,
      },
      {
        boneKey: "spine1",
        boneName: n("spine1"),
        quaternion: spineDir,
      },
      {
        boneKey: "spine2",
        boneName: n("spine2"),
        quaternion: spineDir,
      },
      {
        boneKey: "leftShoulder",
        boneName: n("leftShoulder"),
        quaternion: dirQuat(j.shoulderCenter, j.leftShoulder),
      },
      {
        boneKey: "rightShoulder",
        boneName: n("rightShoulder"),
        quaternion: dirQuat(j.shoulderCenter, j.rightShoulder),
      },
      {
        boneKey: "leftArm",
        boneName: n("leftArm"),
        quaternion: dirQuat(j.leftShoulder, j.leftElbow),
      },
      {
        boneKey: "rightArm",
        boneName: n("rightArm"),
        quaternion: dirQuat(j.rightShoulder, j.rightElbow),
      },
      {
        boneKey: "leftForeArm",
        boneName: n("leftForeArm"),
        quaternion: dirQuat(j.leftElbow, j.leftWrist),
      },
      {
        boneKey: "rightForeArm",
        boneName: n("rightForeArm"),
        quaternion: dirQuat(j.rightElbow, j.rightWrist),
      },
      {
        boneKey: "leftUpLeg",
        boneName: n("leftUpLeg"),
        quaternion: dirQuat(j.leftHip, j.leftKnee),
      },
      {
        boneKey: "rightUpLeg",
        boneName: n("rightUpLeg"),
        quaternion: dirQuat(j.rightHip, j.rightKnee),
      },
      {
        boneKey: "leftLeg",
        boneName: n("leftLeg"),
        quaternion: dirQuat(j.leftKnee, j.leftAnkle),
      },
      {
        boneKey: "rightLeg",
        boneName: n("rightLeg"),
        quaternion: dirQuat(j.rightKnee, j.rightAnkle),
      },
      {
        boneKey: "leftFoot",
        boneName: n("leftFoot"),
        quaternion: dirQuat(j.leftAnkle, j.leftFootIndex),
      },
      {
        boneKey: "rightFoot",
        boneName: n("rightFoot"),
        quaternion: dirQuat(j.rightAnkle, j.rightFootIndex),
      },
    ],
  };
}
