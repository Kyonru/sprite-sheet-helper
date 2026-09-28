/**
 * Headless benchmark for Pose Studio's MediaPipe capture.
 *
 * Runs the APP'S OWN solve (`src/utils/pose-solve.ts`) over a captured landmark
 * sequence and prints the objective metrics from `src/utils/pose-metrics.ts`.
 * Nothing here re-implements the pipeline: a benchmark that re-implements the
 * thing it measures measures itself.
 *
 * Why this exists: pose-quality improvements require a before/after number
 * from a repeatable command. This is that command.
 *
 *   npm run pose:bench -- \
 *     --landmarks <landmarks.json> \
 *     --character <rigged.glb> \
 *     [--fps 24] [--json out.json] [--compare baseline.json]
 *     [--smoothing 1.0] [--beta 0.5]           landmark stage
 *     [--pose-smoothing 0.4] [--pose-beta 0.3] pose stage
 *     [--raw-landmarks] [--raw-pose]           disable either stage
 *     [--root-source rig|contacts|feet|screen] [--no-root-recovery]
 *     [--root-motion preserve|in-place|scaled]
 *     [--contact-trim n] [--contact-toe] [--ground-align]
 *     [--shoulder-across w] [--hip-width auto|<metres>]
 *     [--fixed-skeleton] [--asymmetric-skeleton]
 *
 * `landmarks.json` is the format written by the capture tool: an object with a
 * `frames` array of `{ world: [...33], screen: [...33] }`. Producing one needs
 * a browser (MediaPipe ships as WASM), so capture and measurement are separate
 * steps and a capture can be re-measured any number of times for free.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import { autoDetectRemap } from "../src/utils/bone-remap.ts";
import {
  landmarksToJointPositions,
  type JointPositions,
} from "../src/utils/mediapipe-to-bones.ts";
import {
  applyFixedSkeleton,
  segmentLengthVariation,
  solveFixedSkeleton,
} from "../src/utils/pose-skeleton.ts";
import { JointSmoother, PoseSmoother } from "../src/utils/animation-smoothing.ts";
import { buildRigRetargetMap } from "../src/utils/pose-retargeting.ts";
import {
  canonicaliseFacing,
  solveHeadAimCorrection,
  createRootMotionState,
  solvePoseOntoRig,
  worldDeltaToLocal,
} from "../src/utils/pose-solve.ts";
import {
  detectContacts,
  solveRootFromContacts,
  solveGroundOffset,
  solveRootFromRigFeet,
} from "../src/utils/pose-contacts.ts";
import {
  applyRootMotionMode,
  recoverRootTranslations,
  solveSegmentLengths,
  solveRootFromFeet,
  solveSourceHipHeight,
  type RootMotionMode,
} from "../src/utils/pose-root-motion.ts";
import {
  compareBoneDirections,
  computePoseMetrics,
  median,
  samplePoseWorldPositions,
  yawAmplitudeDeg,
  zeroPhaseSmooth,
} from "../src/utils/pose-metrics.ts";
import { buildAnimationClip, type PoseFrame } from "../src/utils/pose-to-animation.ts";

interface Args {
  landmarks: string;
  character: string;
  fps: number;
  json?: string;
  compare?: string;
  smoothing?: number;
  beta?: number;
  poseSmoothing?: number;
  poseBeta?: number;
  rawLandmarks: boolean;
  rawPose: boolean;
  rootMotion: RootMotionMode;
  rootSource: "feet" | "screen" | "contacts" | "rig";
  noRootRecovery: boolean;
  exportGlb?: string;
  clipName: string;
  faceForward: boolean;
  visThreshold: number;
  contactToe: boolean;
  contactTrim: number;
  solveTrim: number;
  shoulderAcross: number;
  hipWidth?: string;
  fixedSkeleton: boolean;
  skeletonNoFeet: boolean;
  groundAlign: boolean;
  asymmetricSkeleton: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string): string => {
    const i = argv.indexOf(`--${name}`);
    if (i >= 0 && argv[i + 1] !== undefined) return argv[i + 1];
    if (fallback !== undefined) return fallback;
    throw new Error(`--${name} is required`);
  };
  const opt = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    landmarks: resolve(get("landmarks")),
    character: resolve(get("character")),
    fps: Number(get("fps", "0")),
    json: opt("json"),
    compare: opt("compare"),
    smoothing: opt("smoothing") ? Number(opt("smoothing")) : undefined,
    beta: opt("beta") ? Number(opt("beta")) : undefined,
    poseSmoothing: opt("pose-smoothing") ? Number(opt("pose-smoothing")) : undefined,
    poseBeta: opt("pose-beta") ? Number(opt("pose-beta")) : undefined,
    // The plan requires cleanup to stay optional and raw to stay comparable.
    rawLandmarks: argv.includes("--raw-landmarks"),
    rawPose: argv.includes("--raw-pose"),
    rootMotion: (opt("root-motion") ?? "preserve") as RootMotionMode,
    rootSource: (opt("root-source") ?? "rig") as "feet" | "screen" | "contacts" | "rig",
    noRootRecovery: argv.includes("--no-root-recovery"),
    exportGlb: opt("export-glb"),
    clipName: opt("clip-name") ?? "mocap",
    faceForward: !argv.includes("--no-face-forward"),
    visThreshold: Number(opt("vis-threshold") ?? "0.5"),
    contactToe: argv.includes("--contact-toe"),
    contactTrim: Number(opt("contact-trim") ?? "0"),
    // Separate trim for the ROOT SOLVE, so the honest question can be asked:
    // does trimming help because the root got better, or only because fewer
    // frames are being measured?
    solveTrim: Number(opt("solve-trim") ?? opt("contact-trim") ?? "0"),
    shoulderAcross: Number(opt("shoulder-across") ?? "0"),
    hipWidth: opt("hip-width"),
    fixedSkeleton: argv.includes("--fixed-skeleton"),
    skeletonNoFeet: argv.includes("--skeleton-no-feet"),
    groundAlign: argv.includes("--ground-align"),
    asymmetricSkeleton: argv.includes("--asymmetric-skeleton"),
  };
}

async function loadRig(path: string): Promise<THREE.Object3D> {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new Promise((res, rej) => {
    new GLTFLoader().parse(
      ab,
      "",
      (gltf) => res(gltf.scene),
      (err) =>
        rej(
          new Error(
            `${String(err)}\nNote: three.js cannot decode embedded textures outside a browser. ` +
              "Use an untextured rig for benchmarking, or extend this script with a shim.",
          ),
        ),
    );
  });
}

export async function main(): Promise<number> {
  const args = parseArgs();
  if (!existsSync(args.landmarks)) throw new Error(`not found: ${args.landmarks}`);
  if (!existsSync(args.character)) throw new Error(`not found: ${args.character}`);

  // The capture file may omit `visibility`; everything downstream requires it.
  // Normalising once here rather than defaulting at each of the dozen call
  // sites keeps the harness honest about what it is feeding the solve - an
  // absent visibility means "not reported", and the solve's gate reads that as
  // fully visible.
  type RawLandmark = { x: number; y: number; z: number; visibility?: number };
  type Landmark = NormalizedLandmark;
  const raw = JSON.parse(readFileSync(args.landmarks, "utf8")) as {
    fps?: number;
    imageWidth?: number;
    imageHeight?: number;
    frames: { world?: RawLandmark[] | null; screen?: RawLandmark[] | null }[];
  };
  const normalise = (points: RawLandmark[] | null | undefined): Landmark[] | null =>
    points ? points.map((p) => ({ ...p, visibility: p.visibility ?? 1 })) : null;
  const capture = {
    ...raw,
    frames: raw.frames.map((f) => ({
      world: normalise(f.world),
      screen: normalise(f.screen),
    })),
  };
  const fps = args.fps || capture.fps || 30;

  const object = await loadRig(args.character);
  object.updateMatrixWorld(true);

  const boneNames: string[] = [];
  object.traverse((child) => {
    if ((child as THREE.Bone).isBone) boneNames.push(child.name);
  });
  if (boneNames.length === 0) {
    throw new Error(`${args.character} has no bones; a skinned rig is required.`);
  }
  const remap = autoDetectRemap(boneNames);
  const rigMap = buildRigRetargetMap(object, remap);
  if (rigMap.bones.size === 0) {
    throw new Error("No bones matched the auto-detected remap; check the rig's naming.");
  }

  // Character scale, so contact thresholds expressed for a ~1 unit character
  // transfer to rigs authored at other scales.
  const hips = rigMap.bones.get("hips");
  const hipsWorld = new THREE.Vector3();
  hips?.bone.getWorldPosition(hipsWorld);
  const scale = hipsWorld.y > 1e-6 ? hipsWorld.y : 1;

  // Two smoothing stages, matching the app exactly:
  //   JointSmoother  - on raw landmark positions, before bone directions
  //                    (model-preview.tsx)
  //   PoseSmoother   - on the resulting bone rotations, at record time
  //                    (pose-studio-shell.tsx buildSmoothedFrame)
  // Measuring only the first would measure the preview, not what is recorded.
  const landmarkMinCutoff = args.smoothing ?? 1.0;
  const landmarkBeta = args.beta ?? 0.5;
  const poseMinCutoff = args.poseSmoothing ?? 0.4;
  const poseBeta = args.poseBeta ?? 0.3;
  // The rig's toe bones, found as each foot bone's first child. The canonical
  // remap has no toe entry, but the toe is what touches the floor - the foot
  // bone is the ankle, which pivots through the heel-to-toe roll.
  const toeOf = (key: "leftFoot" | "rightFoot"): string | undefined => {
    const foot = rigMap.bones.get(key)?.bone;
    const child = foot?.children.find((c) => (c as THREE.Bone).isBone);
    return child?.name;
  };
  // Ankle by default. Using the toe was measured and is WORSE on this data
  // (11.3 mm mean slide against 9.9 mm): the toe sits further out along the
  // chain, so noise in the ankle's rotation is amplified there. Kept
  // switchable because on a cleaner reconstruction the toe is the more
  // physically correct contact point.
  const useToe = args.contactToe;
  const contactBones = useToe
    ? { left: toeOf("leftFoot"), right: toeOf("rightFoot") }
    : { left: undefined as string | undefined, right: undefined as string | undefined };

  const smoother = new JointSmoother(landmarkMinCutoff, landmarkBeta);
  const poseSmoother = new PoseSmoother(poseMinCutoff, poseBeta);
  const hold = new Map<string, THREE.Quaternion>();
  const rootMotionState = createRootMotionState();

  const usable = capture.frames.filter(
    (f): f is { world: Landmark[]; screen: Landmark[] | null } =>
      Array.isArray(f.world) && f.world.length >= 33,
  );
  if (usable.length === 0) throw new Error("no frames with landmarks in the capture");

  const jointFrames = usable.map((f) => landmarksToJointPositions(f.world));

  // ---- Fixed skeleton (M4) ------------------------------------------------
  // Solved once for the whole clip, then applied to EVERY solve path - raw,
  // reference and smoothed alike. It is a geometric normalisation, not a
  // temporal filter, so putting it on only one path would make the paths
  // incomparable and quietly credit smoothing for its effect.
  const lengthVariation = segmentLengthVariation(jointFrames);
  const measuredSkeleton = solveFixedSkeleton(jointFrames, { symmetric: true });
  const measuredHipWidth = measuredSkeleton.leftHipHalf + measuredSkeleton.rightHipHalf;
  // Percentiles of the observed hip width across the clip. The widest frame is
  // the one where the hip line lies closest to the image plane, so it is the
  // least depth-compressed - which makes a high percentile a self-calibrating
  // lower bound on the true width, with no anthropometric table involved.
  const hipWidths = jointFrames
    .map((f) => f.leftHip.distanceTo(f.rightHip))
    .sort((a, b) => a - b);
  const pct = (q: number) => hipWidths[Math.min(hipWidths.length - 1, Math.floor(q * hipWidths.length))] ?? 0;
  const hipWidthPercentiles = { p50: pct(0.5), p90: pct(0.9), max: hipWidths[hipWidths.length - 1] ?? 0 };

  // The rig's own hip separation, scaled into landmark metres by the ratio of
  // hip heights. The widest observed frame would be a self-calibrating bound,
  // but only on a clip where the performer turns: on a pure profile walk the
  // hip line is foreshortened in EVERY frame (median 22.7 cm, max 24.3 - a 7%
  // spread), so it never reveals its own length and the target has to come from
  // outside the clip. The rig is the natural source, and assuming the performer
  // shares its proportions is the assumption retargeting already makes.
  let rigHipWidth = 0;
  {
    const l = rigMap.bones.get("leftUpLeg")?.bone;
    const r = rigMap.bones.get("rightUpLeg")?.bone;
    if (l && r) {
      const lw = new THREE.Vector3();
      const rw = new THREE.Vector3();
      l.getWorldPosition(lw);
      r.getWorldPosition(rw);
      rigHipWidth = lw.distanceTo(rw);
    }
  }
  const shoulderWidths = jointFrames
    .map((f) => f.leftShoulder.distanceTo(f.rightShoulder))
    .sort((a, b) => a - b);
  const medianShoulderWidth = median(shoulderWidths);
  const sourceHipHeight = median(
    jointFrames.map((f) => f.hipCenter.y - (f.leftAnkle.y + f.rightAnkle.y) * 0.5),
  );
  const autoHipWidth =
    rigHipWidth > 0 && scale > 1e-6 ? rigHipWidth * (sourceHipHeight / scale) : 0;
  const skeleton = args.fixedSkeleton
    ? solveFixedSkeleton(jointFrames, { symmetric: !args.asymmetricSkeleton })
    : null;
  const fixJoints = (j: JointPositions): JointPositions =>
    skeleton ? applyFixedSkeleton(j, skeleton, { feet: !args.skeletonNoFeet }) : j;

  // Median head carriage for this clip, so the neck expresses deviation from
  // it rather than the fixed ear-forward anatomical offset.
  const headAimCorrection = solveHeadAimCorrection(jointFrames.map(fixJoints));


  // --hip-width auto derives from the rig; a number is taken as metres.
  const hipWidthTarget =
    args.hipWidth === undefined
      ? undefined
      : args.hipWidth === "auto"
        ? autoHipWidth
        : Number(args.hipWidth);

  const dt = 1 / fps;

  // ---- Root translation ---------------------------------------------------
  // World landmarks are hip-centred and carry no global motion, so horizontal
  // translation has to come from the screen landmarks.
  let rootTranslations: THREE.Vector3[] | null = null;
  let rootInfo = "off (world landmarks are hip-centred: in-place only)";
  let rootScaleInfo = "";
  let contactInfo = "";
  // Contacts are detected for EVERY run, not only when they drive the root.
  // Foot slide is only comparable across root sources if all of them are
  // judged against the same, independently detected, contacts.
  // Contacts used for MEASUREMENT.
  const contactResult = detectContacts(usable.map((f) => f.world), {
    trimFrames: args.contactTrim,
  });
  // Contacts used for the ROOT SOLVE, which may be trimmed differently.
  const solveContacts =
    args.solveTrim === args.contactTrim
      ? contactResult
      : detectContacts(usable.map((f) => f.world), { trimFrames: args.solveTrim });
  const detectedContacts = {
    left: contactResult.left.map((f) => f.down),
    right: contactResult.right.map((f) => f.down),
  };
  contactInfo =
    ` | ${contactResult.intervals.length} contact intervals, ` +
    `${(contactResult.groundedRatio * 100).toFixed(0)}% grounded`;
  if (!args.noRootRecovery && capture.imageWidth && capture.imageHeight) {
    let recovered: { translations: THREE.Vector3[]; focalPx: number; medianDepth: number; gapFrames: number };
    if (args.rootSource === "rig") {
      // Filled in by the first pass below; a placeholder keeps the shape.
      recovered = { translations: [], focalPx: 0, medianDepth: 0, gapFrames: 0 };
    } else if (args.rootSource === "contacts") {
      const solved = solveRootFromContacts(usable.map((f) => f.world), solveContacts, fps);
      recovered = {
        translations: solved.translations,
        focalPx: 0,
        medianDepth: 0,
        gapFrames: usable.length - solved.solvedFrames,
      };
    } else if (args.rootSource === "feet") {
      const feet = solveRootFromFeet(usable.map((f) => f.world), fps);
      recovered = {
        translations: feet.translations,
        focalPx: 0,
        medianDepth: 0,
        gapFrames: usable.length - feet.plantedFrames,
      };
    } else {
      const segments = solveSegmentLengths(usable.map((f) => f.world));
      recovered = recoverRootTranslations(
        usable.map((f) => f.screen),
        segments,
        { imageWidth: capture.imageWidth, imageHeight: capture.imageHeight },
      );
    }
    // Metres per rig unit. A humanoid whose hips sit between 0.5 and 2 units
    // above the floor is authored in metres; one at ~100 units is in
    // centimetres. Inferring a per-character body-size correction here instead
    // (hips / 0.95 m) conflates unit conversion with the `scaled` mode and put
    // a spurious 9.5% gain on the translation.
    const metresPerUnit = scale > 20 ? 0.01 : 1;
    const sourceHipHeight = solveSourceHipHeight(usable.map((f) => f.world));
    const targetHipHeight = scale * metresPerUnit;
    rootTranslations = applyRootMotionMode(recovered.translations, {
      mode: args.rootMotion,
      metresPerUnit,
      sourceHipHeight,
      targetHipHeight,
    });
    rootScaleInfo =
      ` | performer hips ${sourceHipHeight.toFixed(2)}m, rig hips ${targetHipHeight.toFixed(2)}m` +
      ` (ratio ${(targetHipHeight / Math.max(sourceHipHeight, 1e-6)).toFixed(2)})`;
    const travel = Math.max(...recovered.translations.map((t) => t.length()));
    rootInfo =
      `${args.rootMotion} from ${args.rootSource}` +
      (args.rootSource === "screen"
        ? `, focal ${recovered.focalPx.toFixed(0)}px, median depth ${recovered.medianDepth.toFixed(2)}m`
        : "") +
      `, travel ${travel.toFixed(2)}m` +
      (recovered.gapFrames > 0 ? `, ${recovered.gapFrames} gap frames` : "") +
      rootScaleInfo + contactInfo;
  }

  // ---- Lag-free reference -------------------------------------------------
  // Every landmark, smoothed non-causally across the whole clip. This has no
  // phase lag by construction, so a causal filter's error against it is real
  // lag and real error - unlike error against the raw signal, which cannot
  // distinguish removed noise from removed motion.
  const referenceJoints = (() => {
    const perLandmark: THREE.Vector3[][] = [];
    for (let i = 0; i < 33; i += 1) {
      perLandmark.push(
        usable.map((f) => new THREE.Vector3(f.world[i].x, f.world[i].y, f.world[i].z)),
      );
    }
    const smoothed = perLandmark.map((series) => zeroPhaseSmooth(series, 7));
    return usable.map((f, frameIndex) =>
      f.world.map((p, i) => ({
        x: smoothed[i][frameIndex].x,
        y: smoothed[i][frameIndex].y,
        z: smoothed[i][frameIndex].z,
        visibility: p.visibility,
      })),
    );
  })();

  const frames: PoseFrame[] = [];
  // A FULLY unsmoothed solve is kept alongside - raw landmarks, no pose pass -
  // so smoothing can be judged against it. The plan requires cleanup to stay
  // non-destructive and raw to stay comparable; without this, "less jitter" is
  // indistinguishable from "less motion".
  //
  // It must be solved from RAW landmarks, not merely skip the pose stage. An
  // earlier version compared against a solve that already used smoothed
  // landmarks, which made the metric blind to landmark-stage lag and produced
  // the nonsense result that heavier smoothing improved fidelity.
  const rawFrames: PoseFrame[] = [];
  const rawHold = new Map<string, THREE.Quaternion>();
  const rawRootState = createRootMotionState();
  const referenceFrames: PoseFrame[] = [];
  const refHold = new Map<string, THREE.Quaternion>();
  const refRootState = createRootMotionState();
  let heldFrames = 0;
  const heldByBone = new Map<string, number>();
  const started = Date.now();

  // The `rig` root source needs the poses before it can solve the root, so the
  // whole clip is solved twice: once to learn how the RIG's feet move, then
  // again with the root that cancels exactly that motion. Deriving the root
  // from landmark motion instead leaves a scale mismatch, because the rig's
  // legs are rarely the performer's length.
  const runPass = (rootTrack: THREE.Vector3[] | null) => {
    frames.length = 0;
    rawFrames.length = 0;
    referenceFrames.length = 0;
    hold.clear();
    rawHold.clear();
    refHold.clear();
    smoother.reset();
    poseSmoother.reset();
    Object.assign(rootMotionState, createRootMotionState());
    Object.assign(rawRootState, createRootMotionState());
    Object.assign(refRootState, createRootMotionState());
    heldFrames = 0;
    heldByBone.clear();

  usable.forEach((frame, index) => {
    const raw = fixJoints(landmarksToJointPositions(frame.world));
    // Smooth landmark positions with the SOURCE frame rate, not a render loop.
    const j = args.rawLandmarks ? raw : {
      leftShoulder: smoother.smooth("lShoulder", raw.leftShoulder, dt),
      rightShoulder: smoother.smooth("rShoulder", raw.rightShoulder, dt),
      leftElbow: smoother.smooth("lElbow", raw.leftElbow, dt),
      rightElbow: smoother.smooth("rElbow", raw.rightElbow, dt),
      leftWrist: smoother.smooth("lWrist", raw.leftWrist, dt),
      rightWrist: smoother.smooth("rWrist", raw.rightWrist, dt),
      leftHip: smoother.smooth("lHip", raw.leftHip, dt),
      rightHip: smoother.smooth("rHip", raw.rightHip, dt),
      leftKnee: smoother.smooth("lKnee", raw.leftKnee, dt),
      rightKnee: smoother.smooth("rKnee", raw.rightKnee, dt),
      leftAnkle: smoother.smooth("lAnkle", raw.leftAnkle, dt),
      rightAnkle: smoother.smooth("rAnkle", raw.rightAnkle, dt),
      leftHeel: smoother.smooth("lHeel", raw.leftHeel, dt),
      rightHeel: smoother.smooth("rHeel", raw.rightHeel, dt),
      leftFootIndex: smoother.smooth("lFootIdx", raw.leftFootIndex, dt),
      rightFootIndex: smoother.smooth("rFootIdx", raw.rightFootIndex, dt),
      nose: smoother.smooth("nose", raw.nose, dt),
      earCenter: smoother.smooth("earCenter", raw.earCenter, dt),
      hipCenter: smoother.smooth("hipCenter", raw.hipCenter, dt),
      shoulderCenter: smoother.smooth("shoulderCtr", raw.shoulderCenter, dt),
    };
    // Smoothing moves each landmark independently, so it can re-introduce the
    // very length wobble the fixed skeleton removed. Re-project afterwards.
    const joints = fixJoints(j);

    const time = index * dt;

    // Reference pass: raw landmarks, no smoothing anywhere.
    // Every solve option the measured path uses is applied here too. These
    // references exist to isolate what SMOOTHING costs, so they must differ
    // from it in nothing else: with the head-aim correction on one side only,
    // "error vs lag-free ref" read 8.33 deg with neck->head at 40.2 deg - a
    // fixed convention difference the metric was reporting as pose error.
    const solveOptions = {
      visThreshold: args.visThreshold,
      headAimCorrection,
      shoulderAcrossWeight: args.shoulderAcross,
      hipWidth: hipWidthTarget,
    };

    const rawResult = solvePoseOntoRig({
      object,
      rigMap,
      landmarks: frame.world,
      joints: raw,
      hold: rawHold,
      rootMotionState: rawRootState,
      rootMotion: true,
      modelScale: scale,
      ...solveOptions,
    });
    rawFrames.push({ time, data: rawResult.pose });

    const refResult = solvePoseOntoRig({
      object,
      rigMap,
      landmarks: frame.world,
      joints: fixJoints(landmarksToJointPositions(referenceJoints[index])),
      hold: refHold,
      rootMotionState: refRootState,
      rootMotion: true,
      modelScale: scale,
      ...solveOptions,
    });
    referenceFrames.push({ time, data: refResult.pose });

    const result = solvePoseOntoRig({
      object,
      rigMap,
      landmarks: frame.world,
      joints,
      hold,
      rootMotionState,
      rootMotion: true,
      modelScale: scale,
      rootTranslation: rootTrack?.[index],
      ...solveOptions,
    });
    if (result.heldBones.length > 0) heldFrames += 1;
    for (const key of result.heldBones) heldByBone.set(key, (heldByBone.get(key) ?? 0) + 1);

    if (args.rawPose) {
      frames.push({ time, data: result.pose });
    } else {
      // Mirror buildSmoothedFrame: one timestep for the whole pose, taken from
      // the frame's own timestamp.
      poseSmoother.beginFrame(time);
      frames.push({
        time,
        data: {
          hips: {
            boneName: result.pose.hips.boneName,
            position: poseSmoother.smoothVec("hips.pos", result.pose.hips.position),
            quaternion: poseSmoother.smoothQuat("hips.quat", result.pose.hips.quaternion),
          },
          bones: result.pose.bones.map((bone) => ({
            boneKey: bone.boneKey,
            boneName: bone.boneName,
            position: bone.position
              ? poseSmoother.smoothVec(`${bone.boneName}.pos`, bone.position)
              : undefined,
            quaternion: poseSmoother.smoothQuat(bone.boneName, bone.quaternion),
          })),
        },
      });
    }
  });

  };

  const useRigRoot = args.rootSource === "rig" && !args.noRootRecovery;
  runPass(useRigRoot ? null : rootTranslations);

  if (useRigRoot) {
    // Measure how the rig's own feet move relative to its hips, then re-solve.
    const posed = samplePoseWorldPositions(
      object, rigMap, frames,
      [contactBones.left, contactBones.right].filter((n): n is string => Boolean(n)),
    );
    // Cancel the motion of the actual contact point, not the ankle.
    const hipsRelative = posed.map((w) => {
      const hips = w.get("hips") ?? new THREE.Vector3();
      const pick = (toe: string | undefined, fallback: string) =>
        (toe ? w.get(toe) : undefined) ?? w.get(fallback) ?? hips;
      return {
        left: pick(contactBones.left, "leftFoot").clone().sub(hips),
        right: pick(contactBones.right, "rightFoot").clone().sub(hips),
      };
    });
    const solved = solveRootFromRigFeet(hipsRelative, solveContacts, fps);
    rootTranslations = applyRootMotionMode(solved.translations, {
      mode: args.rootMotion,
      // Already in rig units: the rig's own feet were measured.
      metresPerUnit: 1,
    });
    const travel = Math.max(...solved.translations.map((t) => t.length()));
    rootInfo =
      `${args.rootMotion} from rig feet, travel ${travel.toFixed(2)} units, ` +
      `${usable.length - solved.solvedFrames} airborne frames` + contactInfo;
    runPass(rootTranslations);
  }

  // ---- Ground alignment (M9) ----------------------------------------------
  // Applied last, once the poses and the root are final, because it is defined
  // against where the feet actually ended up. Cannot affect foot slide, which
  // is horizontal by construction - see `solveGroundOffset`.
  let groundInfo = "off";
  if (args.groundAlign) {
    const posed = samplePoseWorldPositions(
      object, rigMap, frames,
      [contactBones.left, contactBones.right].filter((n): n is string => Boolean(n)),
    );
    const footY = posed.map((w) => {
      const pick = (toe: string | undefined, fallback: string) =>
        (toe ? w.get(toe) : undefined) ?? w.get(fallback);
      return {
        left: pick(contactBones.left, "leftFoot")?.y ?? Number.NaN,
        right: pick(contactBones.right, "rightFoot")?.y ?? Number.NaN,
      };
    });
    // The full ContactResult, not the boolean view: this needs `.down` per
    // frame. Passing the boolean view compiled fine while `scripts/` was
    // outside every tsconfig, and reported "no contacts" on a clip with 83.
    const ground = solveGroundOffset(footY, contactResult);
    if (ground.sampledFrames > 0) {
      const hipsBone = rigMap.bones.get("hips")?.bone;
      const localLift = hipsBone
        ? worldDeltaToLocal(hipsBone, new THREE.Vector3(0, ground.offset, 0))
        : new THREE.Vector3(0, ground.offset, 0);
      for (const frame of frames) frame.data.hips.position.add(localLift);
      groundInfo =
        `lifted ${ground.offset.toFixed(4)} units from ${ground.sampledFrames} planted samples; ` +
        `lowest foot now ${ground.lowestAfterOffset.toFixed(4)}`;
    } else {
      // No contact anywhere: there is no observed floor, so nothing is moved.
      groundInfo = "no contacts - no floor to align to, left alone";
    }
  }

  const solveMs = Date.now() - started;
  const metrics = computePoseMetrics(object, rigMap, frames, {
    fps,
    scale,
    contacts: detectedContacts,
    contactBones,
  });

  // How far has smoothing moved the pose away from the raw solve? Low jitter
  // with low deviation means noise was removed; low jitter with HIGH deviation
  // means the signal went with it. Compared in each pose's own root frame, so
  // a difference in overall body orientation cannot masquerade as limb error.
  const smoothedWorld = samplePoseWorldPositions(object, rigMap, frames);
  const rawWorld = samplePoseWorldPositions(object, rigMap, rawFrames);
  const deviation = compareBoneDirections(
    { world: smoothedWorld, rootQuats: frames.map((f) => f.data.hips.quaternion) },
    { world: rawWorld, rootQuats: rawFrames.map((f) => f.data.hips.quaternion) },
  );

  // Error against the lag-free reference. THIS is the number that can pick a
  // winner: lower means closer to the underlying motion, whereas `deviation`
  // above only says how far the pose moved from the noisy raw solve.
  const referenceWorld = samplePoseWorldPositions(object, rigMap, referenceFrames);
  const referenceError = compareBoneDirections(
    { world: smoothedWorld, rootQuats: frames.map((f) => f.data.hips.quaternion) },
    { world: referenceWorld, rootQuats: referenceFrames.map((f) => f.data.hips.quaternion) },
  );
  const rawReferenceError = compareBoneDirections(
    { world: rawWorld, rootQuats: rawFrames.map((f) => f.data.hips.quaternion) },
    { world: referenceWorld, rootQuats: referenceFrames.map((f) => f.data.hips.quaternion) },
  );

  const report = {
    landmarks: args.landmarks,
    character: args.character,
    rigBones: rigMap.bones.size,
    characterScale: Number(scale.toFixed(4)),
    smoothing: {
      landmark: (args.rawLandmarks
        ? "off"
        : { minCutoff: landmarkMinCutoff, beta: landmarkBeta }) as
        | "off"
        | { minCutoff: number; beta: number },
      pose: (args.rawPose ? "off" : { minCutoff: poseMinCutoff, beta: poseBeta }) as
        | "off"
        | { minCutoff: number; beta: number },
    },
    heldFrames,
    shoulderAcrossWeight: args.shoulderAcross,
    fixedSkeleton: skeleton
      ? { symmetric: !args.asymmetricSkeleton, lengths: skeleton }
      : null,
    // Median absolute deviation of each landmark segment's length, as a
    // fraction of its median - the raw wobble a fixed skeleton removes.
    landmarkLengthMadMedian: Number(
      median(Object.values(lengthVariation)).toFixed(4),
    ),
    landmarkLengthMadWorst: Object.entries(lengthVariation)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`),
    rootMotion: args.rootMotion,
    rootInfo,
    groundInfo,
    torsoLeanDeg: 0,
    spineLeanDeg: 0,
    headLeanDeg: 0,
    facingDegrees: 0,
    rootYawPeakToPeakDeg: 0,
    rootYawStdDeg: 0,
    measuredHipWidthM: Number(measuredHipWidth.toFixed(4)),
    measuredShoulderWidthM: Number(medianShoulderWidth.toFixed(4)),
    hipWidthPercentilesM: {
      p50: Number(hipWidthPercentiles.p50.toFixed(4)),
      p90: Number(hipWidthPercentiles.p90.toFixed(4)),
      max: Number(hipWidthPercentiles.max.toFixed(4)),
    },
    hipWidthM: hipWidthTarget ?? null,
    autoHipWidthM: Number(autoHipWidth.toFixed(4)),
    poseDeviationDeg: deviation.overallMeanDeg,
    referenceErrorDeg: referenceError.overallMeanDeg,
    rawReferenceErrorDeg: rawReferenceError.overallMeanDeg,
    worstDeviatingSegment: deviation.perSegment[0]?.segment ?? "",
    solveMs,
    msPerFrame: Number((solveMs / frames.length).toFixed(2)),
    metrics,
  };

  const line = (name: string, value: number | string, note = "") => {
    const v = typeof value === "number" ? value.toPrecision(5) : value;
    console.log(`  ${name.padEnd(28)} ${String(v).padStart(14)}   ${note}`);
  };

  console.log(`\nPose capture benchmark`);
  console.log(`  rig ${rigMap.bones.size} mapped bones, scale ${scale.toFixed(3)}`);
  const describe = (v: "off" | { minCutoff: number; beta: number }) =>
    v === "off" ? "off" : `minCutoff=${v.minCutoff} beta=${v.beta}`;
  console.log(`  landmark smoothing ${describe(report.smoothing.landmark)}`);
  console.log(`  pose smoothing     ${describe(report.smoothing.pose)}`);
  console.log(`  root motion        ${rootInfo}`);
  console.log(`  ground alignment   ${groundInfo}`);
  console.log(
    `  contact points     ${contactBones.left ?? "leftFoot"} / ${contactBones.right ?? "rightFoot"}`,
  );
  console.log(
    `  across-axis        ${args.shoulderAcross > 0 ? `hip + ${args.shoulderAcross} x shoulder, visibility-weighted` : "hip line only"}`,
  );
  console.log(
    `  hip width          ${hipWidthTarget ? `${(hipWidthTarget * 100).toFixed(1)} cm target, depth restored (rig ${(rigHipWidth / scale * 100).toFixed(1)}% of hip height)` : `as measured (median ${(measuredHipWidth * 100).toFixed(1)}, p90 ${(hipWidthPercentiles.p90 * 100).toFixed(1)}, max ${(hipWidthPercentiles.max * 100).toFixed(1)} cm)`}   shoulders ${(medianShoulderWidth * 100).toFixed(1)} cm`,
  );
  console.log(
    `  fixed skeleton     ${skeleton ? (args.asymmetricSkeleton ? "on, per-side" : "on, L/R symmetric") : "off"}` +
      `   (landmark length MAD ${(report.landmarkLengthMadMedian * 100).toFixed(1)}% median, worst ${report.landmarkLengthMadWorst.join(", ")})\n`,
  );
  line("frames", metrics.frames);
  line("fps", metrics.fps);
  line("duration (s)", metrics.durationSec);
  line("stature (rig units)", metrics.statureUnits);
  line("solve ms/frame", report.msPerFrame);
  line("frames with held bones", heldFrames, "occlusion; lower is better");
  {
    const worst = [...heldByBone.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (worst.length > 0) {
      console.log(
        `  ${"held most:".padEnd(28)} ${worst.map(([k, n]) => `${k} ${n}`).join(", ")}`,
      );
    }
  }
  console.log("");
  line("bone-length variance", metrics.boneLengthVariance, "LOWER is better");
  line("angular jitter (deg/s2)", metrics.angularJitterDegPerSec2, "LOWER is better");
  line("root jitter", metrics.rootJitter, "LOWER is better");
  line("quaternion flips", metrics.quaternionDiscontinuities, "LOWER is better");
  {
    const hipsTrack = smoothedWorld.map((w) => w.get("hips")).filter(Boolean) as THREE.Vector3[];
    const xs = hipsTrack.map((v) => v.x);
    const ys = hipsTrack.map((v) => v.y);
    const zs = hipsTrack.map((v) => v.z);
    const span = (a: number[]) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
    {
      const foot = smoothedWorld.map((w) => w.get("leftFoot")).filter(Boolean) as THREE.Vector3[];
      const at = (i: number) => `${hipsTrack[i]?.x.toFixed(2)}/${foot[i]?.x.toFixed(2)}`;
      line("hipsX/leftFootX @0,25,50,70", `${at(0)}  ${at(25)}  ${at(50)}  ${at(70)}`, "rig units");
    }
    line(
      "hips world travel (x/y/z)",
      `${span(xs).toFixed(3)} / ${span(ys).toFixed(3)} / ${span(zs).toFixed(3)}`,
      "rig units",
    );
  }
  line("foot speed median", metrics.footSpeedMedian, "rig units/sec");
  line("foot speed p10", metrics.footSpeedP10, "slowest 10%; contact needs <=0.156");
  line("foot contacts", metrics.footContacts);
  line("contact frames", metrics.contactFrames);
  line("foot slide mean", metrics.footSlideMean, "LOWER is better");
  line("foot slide max", metrics.footSlideMax, "LOWER is better");
  console.log("");
  line(
    "deviation from raw (deg)",
    deviation.overallMeanDeg,
    "smoothing cost: LOW jitter + LOW deviation = noise removed",
  );
  line(
    "error vs lag-free ref (deg)",
    referenceError.overallMeanDeg,
    `raw scores ${rawReferenceError.overallMeanDeg.toFixed(2)}; LOWER is better`,
  );
  if (deviation.perSegment[0]) {
    line("  worst segment", `${deviation.perSegment[0].segment} ${deviation.perSegment[0].meanDeg.toFixed(1)}deg`, "");
  }

  if (args.compare && existsSync(resolve(args.compare))) {
    const before = JSON.parse(readFileSync(resolve(args.compare), "utf8")) as typeof report;
    console.log(`\n  vs ${args.compare}`);
    const delta = (name: string, now: number, then: number, lowerBetter = true) => {
      if (then === 0 && now === 0) return;
      const pct = then !== 0 ? ((now - then) / Math.abs(then)) * 100 : Number.NaN;
      const better = lowerBetter ? now < then : now > then;
      const mark = Math.abs(now - then) < 1e-12 ? "=" : better ? "improved" : "WORSE";
      console.log(
        `  ${name.padEnd(28)} ${then.toPrecision(5).padStart(12)} -> ${now.toPrecision(5).padStart(12)}` +
          `  ${Number.isFinite(pct) ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : ""} ${mark}`,
      );
    };
    delta("bone-length variance", metrics.boneLengthVariance, before.metrics.boneLengthVariance);
    delta("angular jitter", metrics.angularJitterDegPerSec2, before.metrics.angularJitterDegPerSec2);
    delta("root jitter", metrics.rootJitter, before.metrics.rootJitter);
    delta("quaternion flips", metrics.quaternionDiscontinuities, before.metrics.quaternionDiscontinuities);
    delta("foot slide mean", metrics.footSlideMean, before.metrics.footSlideMean);
    delta("frames with held bones", heldFrames, before.heldFrames);
    if (typeof before.poseDeviationDeg === "number") {
      delta("deviation from raw (deg)", deviation.overallMeanDeg, before.poseDeviationDeg);
    }
  }

  // ---- Face the character the way the rig expects -------------------------
  let facingDegrees = 0;
  if (args.faceForward) {
    const hipsBone = rigMap.bones.get("hips")?.bone;
    const parentQuat = new THREE.Quaternion();
    hipsBone?.parent?.getWorldQuaternion(parentQuat);
    const result = canonicaliseFacing(frames, parentQuat);
    frames.length = 0;
    frames.push(...result.frames);
    facingDegrees = result.degrees;
  }
  report.facingDegrees = facingDegrees;
  {
    // Torso lean, to compare against the source footage directly.
    const posed = samplePoseWorldPositions(object, rigMap, frames);
    const lean = posed.map((w) => {
      const hips = w.get("hips");
      const head = w.get("head") ?? w.get("neck");
      if (!hips || !head) return Number.NaN;
      const up = head.clone().sub(hips).normalize();
      return (Math.acos(Math.min(1, Math.max(-1, up.y))) * 180) / Math.PI;
    }).filter((v) => Number.isFinite(v));
    const mean = lean.reduce((a, b) => a + b, 0) / Math.max(1, lean.length);
    line("torso lean (deg)", mean, "hips->head from vertical; a walker is ~0-8");
    const spineLean = posed.map((w) => {
      const hips = w.get("hips");
      const neck = w.get("neck");
      if (!hips || !neck) return Number.NaN;
      const up = neck.clone().sub(hips).normalize();
      return (Math.acos(Math.min(1, Math.max(-1, up.y))) * 180) / Math.PI;
    }).filter((v) => Number.isFinite(v));
    const headLean = posed.map((w) => {
      const neck = w.get("neck");
      const head = w.get("head");
      if (!neck || !head) return Number.NaN;
      const up = head.clone().sub(neck).normalize();
      return (Math.acos(Math.min(1, Math.max(-1, up.y))) * 180) / Math.PI;
    }).filter((v) => Number.isFinite(v));
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    line("  of which spine", avg(spineLean), "hips->neck");
    line("  of which head", avg(headLean), "neck->head");
    report.torsoLeanDeg = mean;
    report.spineLeanDeg = avg(spineLean);
    report.headLeanDeg = avg(headLean);
  }
  {
    const yaw = yawAmplitudeDeg(frames.map((f) => f.data.hips.quaternion));
    line(
      "root yaw peak-to-peak",
      Number(yaw.peakToPeakDeg.toFixed(2)),
      `deg (std ${yaw.stdDeg.toFixed(2)}); level walking is ~8-16 - too LOW means real motion was damped`,
    );
    report.rootYawPeakToPeakDeg = Number(yaw.peakToPeakDeg.toFixed(2));
    report.rootYawStdDeg = Number(yaw.stdDeg.toFixed(2));
  }
  line("facing correction (deg)", facingDegrees, "rotates the clip onto the rig's forward");

  // ---- Optional: write an animated GLB so the result can be LOOKED AT ------
  // Metrics cannot see a character facing the wrong way or a limb through the
  // torso. The facing bug in the EasyMocap experiment passed every automated
  // check and was only caught by rendering the sheet.
  if (args.exportGlb) {
    const clip = buildAnimationClip(frames, args.clipName);
    // Put the rig back in its rest pose before exporting: the exporter writes
    // the CURRENT node transforms as the rest, and the loop above left it on
    // the last frame.
    rigMap.bones.forEach(({ bone, restPosition, restQuat }) => {
      bone.position.copy(restPosition);
      bone.quaternion.copy(restQuat);
      bone.updateMatrix();
    });
    object.updateMatrixWorld(true);

    const buffer = await new Promise<ArrayBuffer>((res, rej) => {
      new GLTFExporter().parse(
        object,
        (result) => {
          if (result instanceof ArrayBuffer) res(result);
          else rej(new Error("expected a binary GLB"));
        },
        rej,
        { binary: true, animations: [clip] },
      );
    });
    const target = resolve(args.exportGlb);
    writeFileSync(target, Buffer.from(buffer));
    console.log(
      `\n  wrote ${target} (clip "${args.clipName}", ${clip.tracks.length} tracks, ${clip.duration.toFixed(2)}s)`,
    );
  }

  if (args.json) {
    writeFileSync(resolve(args.json), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\n  wrote ${args.json}`);
  }
  console.log("");
  return 0;
}
