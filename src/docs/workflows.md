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

These labeled sequences are embedded in the exported JSON/metadata file so your game engine can look them up by name.

## Tips

- Name your animation clips clearly in your 3D tool before exporting — those names become the sequence identifiers.
- For isometric games, the **Isometric** workflow produces the four standard angles (SE, NE, NW, SW) used by most isometric engines.
- The **Platformer** workflow mirrors the right-facing frames to produce the left-facing set, halving the export time.
- Workflows respect your current lighting and effects settings — configure those first.
