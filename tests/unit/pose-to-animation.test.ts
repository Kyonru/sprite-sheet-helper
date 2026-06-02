import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildAnimationClip, type PoseFrame } from "@/utils/pose-to-animation";

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
});
