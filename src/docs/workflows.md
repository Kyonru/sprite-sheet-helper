---
title: Workflows
---

Workflows automate multi-angle sprite sheet generation. Instead of manually rotating the camera and exporting for each direction, a workflow does it all in one pass — capturing every animation at every required camera angle and labeling each sequence automatically.

## Available Workflows

| Workflow       | Directions | Output Labels              |
| -------------- | ---------- | -------------------------- |
| Top-Down 8-Dir | 8          | N, NE, E, SE, S, SW, W, NW |
| Top-Down 4-Dir | 4          | N, E, S, W                 |
| Isometric      | 4          | SE, NE, NW, SW             |
| Platformer     | 2          | Left, Right                |

## How to Run a Workflow

1. Import your model and ensure animations are loaded.
2. Open the **Workflows** tab from the menu bar.
3. Select a workflow preset.
4. Configure output settings (frame size, FPS, export format).
5. Click **Run Workflow**.

The app will automatically rotate the model to each required angle, play through all animation clips, capture frames, and combine everything into the output format you chose.

Before each sequence, the workflow waits for the animation state to apply and moves the camera, then waits for the camera's transform to stop changing before it records anything — a fact about the scene rather than a fixed number of frames, so a loaded machine cannot capture the previous step's angle. Each frame is taken by seeking animation time to `frame × interval` and rendering — not by sampling a playing animation on a timer — so the frames are exactly as far apart as the export says they are, and two runs of the same workflow produce the same pixels.

Re-running a workflow replaces the sequences it captured before rather than adding a second copy of each. Sequences captured by hand are left alone.

You can cancel a running workflow; the active sequence capture is stopped before the workflow exits.

## Workflow Camera Settings

Workflows use a camera draft that can be previewed before capture. Configure these settings in the workflow panel:

- **Camera type** — Perspective or Orthographic. The preview and final workflow capture use the selected type.
- **Distance / zoom** — Controls framing for the selected camera type.
- **Elevation** — Vertical camera angle for the preset or selected direction.
- **Direction / rotation offset** — Rotates the preset directions when you need a different facing convention.
- **Target** — The world-space point the camera frames.

Changing camera type updates the workflow preview, so you can compare perspective and orthographic output before running the capture.

## Animation Selection

The workflow animation list controls which clips generate rows. Animations that are toggled off are skipped and do not create output rows when the workflow runs.

Use this list to hide noisy test clips, duplicate imports, or animations that should not be part of a production atlas. Hidden or disabled clips remain in the model; they are just excluded from workflow generation.

## Frame Count

**Match clip length** takes each animation's frame count from its own clip — `round(duration × fps)` — instead of using one count for every clip. It is on by default: capturing longer than the clip repeats poses that are already in the sheet, and capturing shorter drops the end of the motion.

Typing a frame count for an animation turns matching off for that animation, and the panel shows what the clip asks for at the current rate beside it, along with a warning when the configured count would repeat poses.

**Looping** is a playback setting, not a capture one. Capture seeks animation time and wraps at the end of the clip, so the action never reaches its finish and never consults its loop mode — the choice changes how the animation plays in the viewport and in the workflow preview, and leaves the exported frames alone.

## Scenes With Several Models

A workflow expands over every loaded model, but a step only animates its own — so by default a scene with two characters puts both of them in every sequence. That is the right behaviour for a scene assembled from several models, such as a character holding a separate weapon.

Turn on **Capture one model at a time** (or `--isolateModels true`) to hide the other models while each sequence records, which is what you want when the models are separate characters that happen to be loaded together. The option only appears when more than one model is loaded.

## Force Animation In Place

Use **Force animation in place** when root motion would move the character through the frame during capture. This is helpful for walk/run cycles that should loop in place for game sprites.

The setting is part of workflow animation settings, so it applies to workflow capture and preview without changing the original model file.

## Auto-Fit Framing

A workflow can solve its own framing instead of using the camera distance you dialled in. Before capturing, it measures every animation across its clip, projects the result through each direction's camera, and picks one distance and target that keep the widest pose inside a margin you choose.

Set **Framing** to *Fit to animation* in the workflow dialog, run it from the CLI with `--fit auto --margin <px>`, or use **Fit camera to animation** in the Export Workbench for a single sequence. While it is on, the workflow's distance is solved per run rather than dialled in, and the field says so.

The panel shows a *Measuring animations for auto-fit* phase before capture starts, and lists any warnings — an animation with no measurable geometry, or a solve that did not settle.

See the [CLI guide](cli.md) for the full option list.

## Output Structure

Each animation clip is exported with direction labels appended to the clip name. For example, a model with `idle` and `walk` animations run through **Top-Down 8-Dir** produces:

```text
idle_N
idle_NE
idle_E
idle_SE
idle_S
idle_SW
idle_W
idle_NW
walk_N
walk_NE
...
```

These labeled sequences are embedded in the exported JSON/metadata file so your game engine can look them up by name. Workflow exports also include structured direction metadata: each sequence records its base animation and direction, and `directionalAnimations` groups rows like `walk_N`, `walk_E`, `walk_S`, and `walk_W` under the shared `walk` animation.

## Tips

- Name your animation clips clearly in your 3D tool before exporting — those names become the sequence identifiers.
- For isometric games, the **Isometric** workflow produces the four standard angles (SE, NE, NW, SW) used by most isometric engines.
- The **Platformer** workflow captures both Right and Left directions. Use **Platformer Single Side** if your game will mirror the sprite at runtime.
- Enable **Capture normal maps** before running a workflow if you want every workflow sequence to include real normal map frames.
- Workflows respect your current lighting and effects settings — configure those first.
- Toggle off any animation clips you do not want before running the workflow; disabled clips are not exported as rows.
