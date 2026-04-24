export interface BoneRemap {
  hips: string;
  spine: string;
  spine1: string;
  spine2: string;
  neck: string;
  head: string;
  leftShoulder: string;
  rightShoulder: string;
  leftArm: string;
  rightArm: string;
  leftForeArm: string;
  rightForeArm: string;
  leftUpLeg: string;
  rightUpLeg: string;
  leftLeg: string;
  rightLeg: string;
  leftFoot: string;
  rightFoot: string;
}

export const BODY_PART_LABELS: Record<keyof BoneRemap, string> = {
  hips:          "Hips (root)",
  spine:         "Spine",
  spine1:        "Spine 1",
  spine2:        "Spine 2",
  neck:          "Neck",
  head:          "Head",
  leftShoulder:  "Left Shoulder (clavicle)",
  rightShoulder: "Right Shoulder (clavicle)",
  leftArm:       "Left Upper Arm",
  rightArm:      "Right Upper Arm",
  leftForeArm:   "Left Forearm",
  rightForeArm:  "Right Forearm",
  leftUpLeg:     "Left Upper Leg",
  rightUpLeg:    "Right Upper Leg",
  leftLeg:       "Left Lower Leg",
  rightLeg:      "Right Lower Leg",
  leftFoot:      "Left Foot",
  rightFoot:     "Right Foot",
};

export const MIXAMO_DEFAULT_REMAP: BoneRemap = {
  hips:          "mixamorigHips",
  spine:         "mixamorigSpine",
  spine1:        "mixamorigSpine1",
  spine2:        "mixamorigSpine2",
  neck:          "mixamorigNeck",
  head:          "mixamorigHead",
  leftShoulder:  "mixamorigLeftShoulder",
  rightShoulder: "mixamorigRightShoulder",
  leftArm:       "mixamorigLeftArm",
  rightArm:      "mixamorigRightArm",
  leftForeArm:   "mixamorigLeftForeArm",
  rightForeArm:  "mixamorigRightForeArm",
  leftUpLeg:     "mixamorigLeftUpLeg",
  rightUpLeg:    "mixamorigRightUpLeg",
  leftLeg:       "mixamorigLeftLeg",
  rightLeg:      "mixamorigRightLeg",
  leftFoot:      "mixamorigLeftFoot",
  rightFoot:     "mixamorigRightFoot",
};

const PATTERNS: Record<keyof BoneRemap, RegExp[]> = {
  hips:          [/hips?/i, /pelvis/i, /root/i],
  spine:         [/spine\b/i, /spine_?0/i, /spine_?1/i],
  spine1:        [/spine\s*1/i, /spine_?2/i, /chest/i],
  spine2:        [/spine\s*2/i, /spine_?3/i, /upper.?chest/i],
  neck:          [/neck/i],
  head:          [/^head$/i, /head\b/i],
  leftShoulder:  [/left.?shoulder/i, /l.?clavicle/i, /shoulder.?l\b/i],
  rightShoulder: [/right.?shoulder/i, /r.?clavicle/i, /shoulder.?r\b/i],
  leftArm:       [/left.?arm\b/i, /l.?upper.?arm/i, /arm.?l\b/i, /upper_arm_l/i],
  rightArm:      [/right.?arm\b/i, /r.?upper.?arm/i, /arm.?r\b/i, /upper_arm_r/i],
  leftForeArm:   [/left.?fore.?arm/i, /l.?fore/i, /forearm.?l/i, /lower_arm_l/i],
  rightForeArm:  [/right.?fore.?arm/i, /r.?fore/i, /forearm.?r/i, /lower_arm_r/i],
  leftUpLeg:     [/left.?up.?leg/i, /l.?thigh/i, /upper.?leg.?l/i, /thigh.?l/i],
  rightUpLeg:    [/right.?up.?leg/i, /r.?thigh/i, /upper.?leg.?r/i, /thigh.?r/i],
  leftLeg:       [/left.?leg\b/i, /l.?shin/i, /\bleg.?l\b/i, /shin.?l/i, /calf.?l/i],
  rightLeg:      [/right.?leg\b/i, /r.?shin/i, /\bleg.?r\b/i, /shin.?r/i, /calf.?r/i],
  leftFoot:      [/left.?foot/i, /l.?foot/i, /foot.?l/i],
  rightFoot:     [/right.?foot/i, /r.?foot/i, /foot.?r/i],
};

/** Auto-detect bone remap from a list of bone names found in a model */
export function autoDetectRemap(boneNames: string[]): BoneRemap {
  const remap = { ...MIXAMO_DEFAULT_REMAP };

  for (const key of Object.keys(PATTERNS) as (keyof BoneRemap)[]) {
    for (const pattern of PATTERNS[key]) {
      const match = boneNames.find((n) => pattern.test(n));
      if (match) {
        remap[key] = match;
        break;
      }
    }
  }

  return remap;
}
