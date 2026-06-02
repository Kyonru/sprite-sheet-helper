import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildPlaybackClip,
  getAnimationClipFps,
} from "@/utils/animation-clips";
import {
  STILL_POSE_CLIP_DURATION,
  buildAnimationClip,
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
});
