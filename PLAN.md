# Pose Studio Timeline Keyframe Animation

## Summary
Add a hybrid timeline system to Pose Studio: users author sparse key poses, preview generated in-betweens, and can bake generated frames into the editable frame list when they want. Interpolation will support both character/root direction and IK effector path direction, so hands, elbows, feet, torso, head, and hips move predictably between poses.

## Key Changes

- Add a **Key Pose Timeline** mode to Pose Studio:
  - Capturing a photo creates the first key pose at `0s`.
  - Users can duplicate the current pose into a new key, insert a key before/after, delete keys, reorder keys, and edit key timing/duration.
  - The bottom timeline shows sparse key poses plus generated in-between ticks.
  - Existing captured video/camera frames still work, but can be converted into key poses or baked frames.

- Add hybrid generation:
  - Default timeline remains sparse and readable.
  - Preview/playback uses generated interpolated frames.
  - Add **Bake Generated Frames** to convert the current generated animation into editable `PoseFrame[]`.
  - Save/export always bakes to the existing `PoseFrame[]` and `AnimationClip` path, so project/export compatibility stays unchanged.

- Add interpolation controls per transition:
  - Duration, generated FPS/frame count, easing, and interpolation type.
  - Quaternion slerp for rotations, vector lerp/curve interpolation for positions.
  - Hold/step interpolation for deliberate pauses.
  - Quality markers should distinguish captured keys from generated frames.

- Add IK motion direction:
  - Store session-only IK target snapshots for key poses when IK handles are used.
  - Per transition, expose root/facing direction controls: stationary, forward, backward, left, right, custom angle.
  - Per IK effector, expose path controls: straight, arc up, arc down, arc left/right, hold, and custom pole bias.
  - Generated frames interpolate IK targets along those paths, solve IK per sample, then bake FK overrides into the generated `PoseFrame`.
  - If an IK chain is unavailable, fall back to FK interpolation and show a warning for that transition.

- Update UI:
  - Timeline gets key pose cards, generated-frame ticks, transition strips, add-key buttons, and a bake button.
  - Inspector gets a new **Timeline** tab or section for transition duration, FPS, easing, root direction, and IK path controls.
  - Viewport can show ghost poses for previous key, current key, next key, and generated preview frame.
  - Save panel reports key count, generated frame count, baked frame count, duration, and any IK fallback warnings.

## Interfaces

- Keep persisted/saved output compatible:
  - `PoseFrame` remains unchanged.
  - `buildAnimationClip(...)` remains the final save/export path.
  - No new project schema fields in this pass.

- Add session-only Pose Studio timeline types:
  - `PoseTimelineKeyframe`
  - `PoseTimelineTransition`
  - `PoseTimelineDraft`
  - `PoseInterpolationSettings`
  - `PoseIkTargetSnapshot`
  - `PoseIkPathDirection`
  - `PoseRootDirection`

- Add pure utilities, likely under `src/utils/pose-timeline.ts`:
  - create/duplicate/insert/delete/reorder keyframes
  - shift key times and transition durations
  - interpolate `PoseBoneData`
  - generate preview frames from sparse keys
  - bake generated frames into `PoseEditDraft`
  - preserve/shift quality markers and edit history

- Extend the workbench state helpers in `src/components/pose-studio/workspace.ts`:
  - active timeline mode
  - selected keyframe / selected transition
  - generated preview frame index
  - bake status and transition warnings

## Test Plan

- Unit tests:
  - keyframe insert/delete/reorder/time shifting
  - transition duration and generated frame count
  - quaternion/vector interpolation
  - easing and hold interpolation
  - quality marker shifting for sparse keys and baked frames
  - bake generated timeline into `PoseFrame[]`
  - IK path interpolation for straight/arc/hold target motion
  - fallback behavior when IK chains are missing

- Integration/manual checks:
  - Capture one photo, duplicate into several key poses, edit each, preview animation.
  - Create hand/foot/head IK transitions with different path directions.
  - Set root/facing direction and confirm generated motion follows it.
  - Bake generated frames, edit an in-between frame, undo/redo cleanly.
  - Save clip and confirm it appears in the Animation panel and exports normally.
  - Confirm old photo/video/camera capture flows still work.

- Run:
  - `npm run test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

## Assumptions

- Use the hybrid model requested: sparse keys by default, with explicit baking when desired.
- Implement both root direction and IK effector path direction in v1.
- Timeline/interpolation data is session-only; saved clips remain compatible with existing exports.
- Generated IK frames are baked into FK pose data before save/export.
