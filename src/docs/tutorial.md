---
title: Tutorial
---

# Tutorial

This tutorial walks you through the full workflow from an empty scene to an exported LÖVE 2D sprite sheet. You'll import a model, configure animations and lighting, set up sequences, run a workflow, and export — all using a sample project provided below.

## What You'll Learn

- Importing and removing a model
- Changing the active animation
- Adding a light to the scene
- Creating animation sequences
- Running a directional workflow
- Exporting to LÖVE 2D format

---

## Step 1 — Download the Sample Project

Download the sample project below and extract it to a folder on your machine.

> **[Download sample project](#LINK_SAMPLE_PROJECT)**

The archive contains:
- `tutorial.sshProj` — a pre-configured project file with a model already set up
- `character.glb` — the 3D character model used in this tutorial

Open the project in Sprite Sheet Helper via `File > Open Project` and select `tutorial.sshProj`.

---

## Step 2 — Import a Model

The project comes with a model loaded, but let's practice importing one from scratch.

1. Go to `File > Import Model`.
2. Navigate to the extracted folder and select `character.glb`.
3. The model appears in the center viewport and the left panel lists it in the scene tree.

---

## Step 3 — Remove the Model

Now remove the model you just imported so we can work with the one from the project file.

1. In the **left panel**, click the model entry to select it.
2. Right-click and choose **Remove**, or press `Delete`.
3. The viewport clears. The project's original model is still in the scene — it was not affected.

> If the viewport looks empty after removing, the project model may have been the one you imported. Re-open the project via `File > Open Project` to restore it.

---

## Step 4 — Use the Existing Model

With the project model in place you should see the character standing in the viewport. Take a moment to explore the scene:

- **Left-click + drag** in the viewport to orbit the camera.
- **Scroll** to zoom in and out.
- Click the model entry in the **left panel** to inspect its transform (position, rotation, scale) in the properties area.

---

## Step 5 — Change the Animation

The model has several animation clips embedded. Let's switch to the walk cycle.

1. In the **Export panel** on the right, find the **Animation** dropdown.
2. Open the dropdown — you'll see all available clips (e.g. `idle`, `walk`, `run`).
3. Select **walk**.
4. The viewport updates to preview the walk animation in a loop.

To adjust the clip, open the **Animations** panel from the menu bar and configure speed or loop mode as needed.

---

## Step 6 — Add a Light

The default scene has basic lighting. Let's add a directional light to give the character more definition.

1. Open the **Lighting** tab from the menu bar.
2. Click **Add Light** and choose **Directional**.
3. A new directional light appears in the scene and in the left panel.
4. Adjust its **Intensity** to around `1.2` and set the **Color** to a warm white.
5. Move the light's **Position** so it comes from slightly above and to the left of the model — this creates a clear key light with visible shadows.

---

## Step 7 — Add a Sequence

Sequences let you define which animation clips to include in the export and in what order.

1. Open the **Export panel** on the right.
2. Find the **Sequences** section and click **Add Sequence**.
3. Name the sequence `walk`.
4. Set the **Animation** to the `walk` clip.
5. Set **Frames** to `8` and **FPS** to `10`.
6. Repeat to add an `idle` sequence using the `idle` clip.

You should now have two sequences queued for export.

---

## Step 8 — Run a Workflow

Workflows automatically capture every sequence from every camera direction in one pass. For a top-down game with 4 directional movement:

1. Open the **Workflows** tab from the menu bar.
2. Select the **Top-Down 4-Directional** preset.
3. Confirm the frame size (e.g. 128×128) and FPS match your sequences.
4. Click **Run Workflow**.

The app rotates the model to each direction (N, E, S, W), captures all sequences, and assembles the atlas. When it finishes the export panel shows the completed sprite sheet.

The output will contain 8 labeled sequences: `idle_N`, `idle_E`, `idle_S`, `idle_W`, `walk_N`, `walk_E`, `walk_S`, `walk_W`.

---

## Step 9 — Export to LÖVE 2D

1. In the **Export panel**, open the **Format** dropdown.
2. Select **LÖVE 2D (Lua)**.
3. Click **Export** and choose a destination folder.

The export produces:

```text
spritesheet.png    ← the full sprite atlas
spritesheet.lua    ← Lua module with all animation definitions
main.lua           ← example usage you can paste into your game
```

### Using the Output in LÖVE 2D

```lua
local sprite = require("spritesheet")

function love.load()
  character = sprite.load("spritesheet.png")
  current = "walk_S"
end

function love.update(dt)
  character:update(current, dt)
end

function love.draw()
  character:draw(current, 400, 300)
end
```

---

## You're Done

You've completed the full workflow: imported a model, configured animations and lighting, set up sequences, generated a multi-directional sprite sheet with a workflow, and exported it ready for LÖVE 2D.

From here you can explore other export formats in the [Exporting](exporting) doc, or learn how to use the [CLI](cli) to automate this same process as part of a build pipeline.
