---
title: Projects
---

A **project file** (`.sshProj`) saves your entire scene state so you can pick up exactly where you left off.

## What Gets Saved

- Imported model and its transform (position, rotation, scale)
- All lights (type, position, color, intensity)
- Camera angle and distance
- Active post-processing effects and their settings
- Animation clip configuration (speed, trim, loop mode)
- Export settings (format, frame size, FPS)
- Full undo/redo history

## Saving a Project

Go to `File > Save Project` (or `File > Save Project As` to save a copy). Choose a location and filename — the file is saved as `<name>.sshProj`.

## Opening a Project

Go to `File > Open Project` and select a `.sshProj` file. The entire scene is restored to the state it was in when you last saved.

## Tips

- Save your project before running a workflow or doing a large export — it's a good checkpoint.
- Project files are plain JSON, so you can inspect or version-control them with git if needed.
- The project file stores a reference to the model file path. If you move the model file, reopen the project and re-import the model.
