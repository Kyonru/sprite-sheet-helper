import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildPlaybackClip,
  getAnimationClipFps,
} from "@/utils/animation-clips";
import {
  STILL_POSE_CLIP_DURATION,
  buildAnimationClip,
  enforceQuaternionContinuity,
  getPoseClipDuration,
  type PoseFrame,
} from "@/utils/pose-to-animation";

describe("buildAnimationClip", () => {
  it("creates position and quaternion tracks from pose frames", () => {
    const frames: PoseFrame[] = [0, 0.5, 1].map((time) => ({
      time,
      data: {
        hips: {
          boneName: "Hips",
          position: new THREE.Vector3(0, time, 0),
          quaternion: new THREE.Quaternion(),
        },
        bones: [
          {
            boneKey: "leftArm",
            boneName: "LeftArm",
            quaternion: new THREE.Quaternion().setFromEuler(
              new THREE.Euler(time, 0, 0),
            ),
          },
        ],
      },
    }));

    const clip = buildAnimationClip(frames, "Captured Pose");

    expect(clip.name).toBe("Captured Pose");
    expect(clip.duration).toBe(1);
    expect(clip.tracks.map((track) => track.name)).toEqual([
      "Hips.position",
      "Hips.quaternion",
      "LeftArm.quaternion",
    ]);
    expect(clip.tracks[0].times).toEqual(new Float32Array([0, 0.5, 1]));
  });

  it("turns a single captured pose into a short hold clip that survives playback", () => {
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, Math.PI / 3, 0),
    );
    const frames: PoseFrame[] = [
      {
        time: 0,
        data: {
          hips: {
            boneName: "mixamorigHips",
            position: new THREE.Vector3(0, 0, 0),
            quaternion: new THREE.Quaternion(),
          },
          bones: [
            {
              boneKey: "leftArm",
              boneName: "mixamorigLeftArm",
              quaternion: rotation,
            },
          ],
        },
      },
    ];

    const clip = buildAnimationClip(frames, "Still Pose");
    const playback = buildPlaybackClip(
      clip,
      0,
      clip.duration,
      getAnimationClipFps(clip),
    );

    expect(getPoseClipDuration(frames)).toBe(STILL_POSE_CLIP_DURATION);
    expect(clip.duration).toBe(STILL_POSE_CLIP_DURATION);
    expect(clip.tracks[0].times).toEqual(
      new Float32Array([0, STILL_POSE_CLIP_DURATION]),
    );
    expect(playback.generated).toBe(false);
    expect(playback.clip.tracks.map((track) => track.name)).toEqual([
      "mixamorigHips.position",
      "mixamorigHips.quaternion",
      "mixamorigLeftArm.quaternion",
    ]);
    expect(playback.clip.tracks[2].values).toEqual(
      new Float32Array([
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
      ]),
    );
  });

  it("creates bone position tracks when pose frames include moved bones", () => {
    const frames: PoseFrame[] = [0, 0.5].map((time) => ({
      time,
      data: {
        hips: {
          boneName: "mixamorigHips",
          position: new THREE.Vector3(0, 0, 0),
          quaternion: new THREE.Quaternion(),
        },
        bones: [
          {
            boneKey: "leftArm",
            boneName: "mixamorigLeftArm",
            position: new THREE.Vector3(time, 2, 3),
            quaternion: new THREE.Quaternion(),
          },
        ],
      },
    }));

    const clip = buildAnimationClip(frames, "Moved Pose");
    const positionTrack = clip.tracks.find(
      (track) => track.name === "mixamorigLeftArm.position",
    );

    expect(positionTrack).toBeInstanceOf(THREE.VectorKeyframeTrack);
    expect(positionTrack?.values).toEqual(
      new Float32Array([0, 2, 3, 0.5, 2, 3]),
    );
  });
});

describe("quaternion sign continuity", () => {
  it("removes hemisphere flips without changing the rotations", () => {
    // q and -q are the same rotation, but a flip between keyframes makes the
    // interpolator take the long way round - a limb spinning through the body
    // for one frame.
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4);
    const values = [
      q.x, q.y, q.z, q.w,
      -q.x, -q.y, -q.z, -q.w,
      q.x, q.y, q.z, q.w,
      -q.x, -q.y, -q.z, -q.w,
    ];
    const flips = enforceQuaternionContinuity(values);
    expect(flips).toBe(2);

    // Every keyframe still represents the SAME rotation as the original.
    for (let i = 0; i < values.length; i += 4) {
      const out = new THREE.Quaternion(values[i], values[i + 1], values[i + 2], values[i + 3]);
      expect(Math.abs(out.dot(q))).toBeCloseTo(1, 9);
    }
    // ...and no consecutive pair is on opposite hemispheres any more.
    for (let i = 4; i < values.length; i += 4) {
      const a = new THREE.Quaternion(values[i - 4], values[i - 3], values[i - 2], values[i - 1]);
      const b = new THREE.Quaternion(values[i], values[i + 1], values[i + 2], values[i + 3]);
      expect(a.dot(b)).toBeGreaterThanOrEqual(0);
    }
  });

  it("leaves an already-continuous track untouched", () => {
    const values = [0, 0, 0, 1, 0, 0.1, 0, 0.995, 0, 0.2, 0, 0.98];
    const copy = [...values];
    expect(enforceQuaternionContinuity(values)).toBe(0);
    expect(values).toEqual(copy);
  });

  it("handles empty and single-keyframe tracks", () => {
    expect(enforceQuaternionContinuity([])).toBe(0);
    expect(enforceQuaternionContinuity([0, 0, 0, 1])).toBe(0);
  });

  it("built clips carry continuous quaternion tracks", () => {
    // A pose that flips hemisphere between frames must come out of
    // buildAnimationClip already corrected.
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.6);
    const flipped = new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w);
    const frame = (time: number, quat: THREE.Quaternion): PoseFrame => ({
      time,
      data: {
        hips: {
          boneName: "Hips",
          position: new THREE.Vector3(0, 1, 0),
          quaternion: quat.clone(),
        },
        bones: [
          { boneKey: "spine", boneName: "Spine", quaternion: quat.clone() },
        ],
      },
    });

    const clip = buildAnimationClip([frame(0, q), frame(0.1, flipped), frame(0.2, q)], "t");
    for (const track of clip.tracks) {
      if (!(track instanceof THREE.QuaternionKeyframeTrack)) continue;
      const v = track.values;
      for (let i = 4; i < v.length; i += 4) {
        const dot =
          v[i - 4] * v[i] + v[i - 3] * v[i + 1] + v[i - 2] * v[i + 2] + v[i - 1] * v[i + 3];
        expect(dot).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
