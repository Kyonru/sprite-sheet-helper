---
title: Pose Studio
---

Pose Studio turns webcam, video, or photo poses into animation clips for the selected model. Pose detection runs locally in the browser; no video or image is uploaded.

Saved clips appear in the Animation panel alongside embedded clips and can be exported like any other animation.

## Opening Pose Studio

Use the **Pose** menu in the main toolbar, or select a loaded model and click **Create Pose / Motion Clip** in the Animation panel.

---

## Step 1 — Capture

Choose an input source:

| Mode       | Best for                                       |
| ---------- | ---------------------------------------------- |
| **Photo**  | Creating a single posture from a still image   |
| **Video**  | Recording motion from an uploaded video file   |
| **Camera** | Recording continuous movement from your webcam |

The status row shows whether the model is ready, whether a pose is detected, and how many mapped bones match the selected model.

### Root Motion

Turn on **Root Motion** before recording when vertical hip motion matters, such as crouching or jumping. Leave it off for most in-place loops.

### Bone Mapping

Pose Studio auto-detects a mapping from model bone names when it opens. If a model uses unusual names, expand **Bone Mapping**, adjust fields manually, or run **Auto-detect** again.

---

## Step 2 — Edit

Use the timeline to scrub through captured frames. The model preview updates to the selected frame.

### Direct Bone Editing

Mapped bones show handles in the preview. Select a handle or a bone name, then rotate the selected bone with the on-canvas rotate control. The X/Y/Z values in the selected-bone panel stay in sync.

### Guided Controls

The side panel groups bones by body area. Each selected bone supports:

| Control          | Effect                                      |
| ---------------- | ------------------------------------------- |
| X / Y / Z        | Rotate the bone in parent-local space       |
| Reset            | Clear this bone's override on the frame     |
| Apply to all     | Copy this bone override to every frame      |

Pose actions include mirror current, mirror all, copy pose, paste pose, flip 180, reset current, reset all edits, undo, and redo.

### Trim & Delete

| Control      | Effect                                    |
| ------------ | ----------------------------------------- |
| Trim start   | Discard all frames before the current one |
| Delete frame | Remove the current frame only             |
| Trim end     | Discard all frames after the current one  |

---

## Step 3 — Save

Enter a clip name and click **Save to Model**. The new clip is added to the model and becomes the active animation.

---

## Tips

- Stand 2–3 metres from the camera with your full body visible for the most accurate tracking.
- For photo poses, use clear silhouettes and front-facing light.
- For looping animations, record a few extra frames at the start and end, then trim to a clean loop in the edit step.
- If a limb is occluded during recording, Pose Studio holds its last reliable rotation; use the edit step to correct those frames.
