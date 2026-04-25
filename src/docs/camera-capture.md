---
title: Camera Animation Capture
---

# Camera Animation Capture

You can record live poses from your webcam or from a static photo and bake them into animation clips on your model. All pose detection runs entirely in the browser — no video is uploaded anywhere.

The captured clip appears in the Animation panel alongside any embedded clips and can be exported like any other animation.

## Opening the Capture Flow

In the **Animation** panel, click **Add from image**. A modal opens and walks you through four steps: Disclaimer → Capture → Review → Save.

---

## Step 1 — Capture

Choose an input source at the top of the Capture step:

| Mode | Best for |
| --- | --- |
| **Camera** | Recording continuous movement from your webcam |
| **Photo Upload** | Capturing a single static pose from an image file |

### Camera mode

1. Click **Record**. A `● REC` badge and elapsed time appear over the video feed.
2. Perform the motion in front of the camera.
3. Click **Stop** when done. The frame counter shows how many frames were recorded.
4. Click **Next →**.

### Photo mode

1. Click the file input and choose an image that shows a full or half body.
2. Pose detection runs automatically. When the green skeleton overlay appears, click **Capture Pose**.
3. Click **Next →**.

### Root Motion

Toggle **Root Motion** before recording if the character moves vertically during the clip (e.g. jumping, crouching). When off, the hips bone stays at the origin — correct for most in-place looping animations.

### Bone Mapping

If your model uses non-standard bone names, expand **Bone Mapping** and enter the correct names, or click **Auto-detect** to match names by pattern. The mapping is used when baking the recorded rotations into the rig.

---

## Step 2 — Review & Correct

The review step lets you scrub through every captured frame, clean up the clip, and fix pose problems before saving.

### Timeline

Drag the scrubber to step through frames one by one. The 3D model updates instantly to show the pose at each frame.

### Trim & delete

| Control | Effect |
| --- | --- |
| ⊢ Trim start | Discard all frames before the current one |
| Delete frame | Remove the current frame only |
| Trim end ⊣ | Discard all frames after the current one |

### Global Corrections

Expand the **Corrections** panel to apply the same transform to every frame at once:

| Control | Effect |
| --- | --- |
| X slider | Tilt the whole pose forward or backward |
| Y slider | Rotate the character left or right |
| Z slider | Lean the pose left or right |
| ⇄ Mirror L↔R | Swap left and right limbs and reflect their rotations |
| ↺ Flip 180° | Add 180° on the Y axis — use when the clip was captured from behind |
| Reset | Return all sliders to zero and turn off mirror |

Global corrections are non-destructive during review and are only baked into the frame data when you click **Save →**.

### Bone Adjustments

Expand the **Bone Adjustments** panel to rotate individual bones on the current frame:

1. Click a bone name (e.g. *L Upper Arm*) to expand it.
2. Drag the **X / Y / Z** sliders to adjust that bone's rotation in parent-local space.
3. A `●` dot appears on any bone that has an active override on the current frame.

| Control | Effect |
| --- | --- |
| Reset bone | Remove the override for this bone on this frame |
| Apply to all frames | Copy this bone's current override to every frame in the clip |

Bone overrides are applied after global corrections, so you can mirror or flip the whole pose first and then fine-tune individual limbs on top.

---

## Step 3 — Save

Enter a name for the clip and click **Save**. The animation is added to your model and set as the active clip. You can then adjust its speed, loop mode, and trim range in the Animation panel.

---

## Tips

- Stand 2–3 metres from the camera with your full body visible for the most accurate tracking.
- Wear clothes that contrast with the background — the pose model works best when your silhouette is clearly defined.
- Record in even, front-facing light; strong light from behind will reduce tracking quality.
- If a limb passes behind your body, the tracker holds its last known rotation rather than guessing. Use the review step to trim or delete those frames.
- For looping animations, record a few extra frames at the start and end, then trim to a clean loop in the review step.
