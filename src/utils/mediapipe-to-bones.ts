import * as THREE from "three";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { BoneRemap } from "./bone-remap";

// ── MediaPipe landmark indices ─────────────────────────────────────────────
const IDX = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
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
  /**
   * Midpoint of the ears.
   *
   * Preferred over the nose for aiming the neck and head. The nose sits well
   * FORWARD of the head's axis, so aiming a bone whose rest direction is
   * "straight up" at the nose books that fixed anatomical offset as head-down
   * rotation. Measured on a walking clip, aiming at the nose produced 56.4
   * degrees of neck-to-head lean where a walker shows almost none.
   */
  earCenter: THREE.Vector3;
  hipCenter: THREE.Vector3;
  shoulderCenter: THREE.Vector3;
}

function toLH(p: NormalizedLandmark): THREE.Vector3 {
  // worldLandmarks: X = camera-right (negate so character's left = -X when facing +Z),
  // Y = image-down (negate for Three.js Y-up), Z dropped: keeping Z positive-toward-camera
  // causes a forward lean (chest is always closer to camera than hips).
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
    earCenter: toLH(lm[IDX.LEFT_EAR])
      .add(toLH(lm[IDX.RIGHT_EAR]))
      .multiplyScalar(0.5),
    hipCenter: lh.clone().add(rh).multiplyScalar(0.5),
    shoulderCenter: ls.clone().add(rs).multiplyScalar(0.5),
  };
}

// ── Bone frame types (used by recording + animation clip creation) ─────────

export interface BoneFrame {
  boneKey: keyof BoneRemap;
  boneName: string;
  position?: THREE.Vector3;
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

