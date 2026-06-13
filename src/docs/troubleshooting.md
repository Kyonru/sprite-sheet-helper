---
title: Troubleshooting
---

Use this page when an export, capture, pose, or effects setup does not behave as expected.

## Export Is Blocked

- Check the Export Preflight validation messages.
- Increase max atlas size if a page is too large.
- Disable multi-page output for engine exporters, or use the generic Sprite Sheet exporter.
- Capture at least one frame before preparing an export.

## Normal Atlas Is Empty

Turn on **Capture normal maps** before recording frames. If frames were captured before the toggle was enabled, recapture them or accept transparent placeholders.

## Effects Look Different During Export

Exports use the enabled effect stack in order. If output is unexpected, check stack order and use each effect's enable switch to compare the viewport with and without that effect.

## Sprite Looks Smaller After Adding Outline

Spritesheet Postprocess expands frames with transparent padding when an outline, shadow, or glow would otherwise be clipped. The character pixels may stay the same size, but the exported frame becomes larger, so the sprite can appear smaller inside the frame. This is expected and keeps the outline safe at atlas edges.

Use the postprocess preview zoom controls to inspect the result. If you want pixel-art-style edges, set Outer Outline to **Crisp Pixel**.

## Spritesheet Postprocess Preview Looks Different

The postprocess preview compares original and processed frames after temporary alignment. The exported files are still generated from the processed frame rows before atlas packing.

If the preview looks surprising:

- Confirm the **Before / After** divider is showing the side you expect.
- Check whether outline, glow, or shadow padding expanded the processed frame.
- Use preview zoom for inspection only; it does not change export size.
- Remember that normal-map frames are padded to match color frame dimensions but are not color-processed.

## Workflow Output Changed

- Confirm workflow preset, frames, FPS, size, camera distance, and atlas settings.
- Confirm workflow camera type, camera draft settings, and animation enable toggles.
- Check whether **Force animation in place** is enabled for root-motion clips.
- Disable temporal effects such as Glitch, Noise, Smear, animated Scanline, or Shockwave.
- Compare `spritesheet.png`, `spritesheet_normal.png`, and normalized `spritesheet.json`.

## App Crash Recovery

If the app catches a crash, it opens a recovery dialog. Your project state is saved just before the dialog appears, so **Reload and restore project** is usually the right choice — it reloads the app and restores the recovery snapshot.

Use **Save debug trail** to download a zip containing the current project snapshot and crash context before taking any destructive action — attach it when reporting a bug.

Use **Reset app** only when you want to clear the recovery snapshot and restart all project-domain stores from a blank state. Unsaved progress is lost.

## A Model Won't Load After Reopening a Project

Model files are stored in the browser's private storage (OPFS). If a model shows a "Could not restore model file" warning:

- If the project was saved as a `.sshProj`, reopen it via `File > Open Project` — the archive bundles the model files and restores them.
- If you only relied on automatic recovery and the browser's site data was cleared (or you switched browsers/profiles), the model file is gone. Re-import the model into the scene.
- Procedural (authored) models are rebuilt from the project data and are not affected.

## Storage Is Full / Saves Fail

The app warns when browser storage is almost full and shows an error when a model or texture cannot be persisted. Export a `.sshProj` backup first, then free up space — remove unused models, or clear other site data — and try again. See the **Projects** page, "Storage Limits & Durability", for details.

## Pose Looks Broken

Open Pose Studio mapping checks and verify torso, head, arm, and leg chains. If a hand or foot target moves oddly, remap the endpoint to a stable hand or foot bone instead of a finger or toe helper.
