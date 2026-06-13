---
title: Projects
---

A **project file** (`.sshProj`) saves your entire scene state so you can pick up exactly where you left off.

## What Gets Saved

- Imported model and its transform (position, rotation, scale)
- All lights (type, position, color, intensity)
- Camera angle and distance
- Active post-processing effects and their settings
- Spritesheet postprocess settings for export-time 2D effects
- Animation clip configuration (speed, trim, loop mode)
- Export settings (format, frame size, FPS)
- Material assets, material assignments, and generated texture variants
- Full undo/redo history

## Saving a Project

Go to `File > Save Project` (or `File > Save Project As` to save a copy). Choose a location and filename — the file is saved as `<name>.sshProj`.

## Opening a Project

Go to `File > Open Project` and select a `.sshProj` file. The entire scene is restored to the state it was in when you last saved.

## Automatic Recovery

Sprite Sheet Helper keeps a browser-local recovery snapshot while you work. If the tab refreshes, the app is closed and reopened, or a PWA update reloads the page, the latest local project state is restored automatically.

Recovery snapshots are stored only in the current browser profile. They are not a replacement for a `.sshProj` file, and OPFS-backed model or texture assets still need to remain available in the browser's local storage.

## Storage Limits & Durability

Models and textures are stored in the browser's private storage (OPFS), which has a quota set by the browser. The app warns you when storage is almost full, and shows an error if a model or texture cannot be saved because the quota is exceeded.

When you save a `.sshProj`, the archive bundles project JSON plus model files and texture files known to the project, including uploaded material textures and generated texture variants. While you are working before a save, those files still live in browser-local storage.

Spritesheet postprocess settings are stored as project JSON because they are small serializable export settings. They do not create extra files until you export a spritesheet.

Keep in mind:

- **Clearing site data deletes your assets.** Clearing cookies/site storage for the app removes stored models, textures, and the recovery snapshot. Your `.sshProj` files on disk are unaffected.
- **Storage is per browser profile.** Assets saved in one browser (or private window) are not visible in another.
- **A `.sshProj` file is the durable backup.** It bundles the project plus its model and texture files into one archive. Save one regularly — especially after the app warns that storage is almost full.

If a save fails with a storage-full error, export a `.sshProj` backup, then free up space (remove unused models from the scene, or clear other site data) and try again.

## Tips

- Save your project before running a workflow or doing a large export — it's a good checkpoint.
- Project files are plain JSON, so you can inspect or version-control them with git if needed.
- The project file stores a reference to the model file path. If you move the model file, reopen the project and re-import the model.
