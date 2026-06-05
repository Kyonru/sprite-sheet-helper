# Sprite Sheet Helper CI Example

This is a tiny repository template for generating sprite assets from every model in `models/` with the Sprite Sheet Helper GitHub Action.

Copy this `example/` folder into a new GitHub repository, add your `.fbx`, `.glb`, `.gltf`, or `.obj` files to `models/`, and push to `main`. The workflow will discover every model, generate a batch config, run the Action, and upload the generated sprites as a workflow artifact.

## What It Does

- Runs on every push to `main`.
- Finds all supported model files under `models/`.
- Generates `sprite-sheet-helper.generated.json`.
- Runs `Kyonru/sprite-sheet-helper/action@latest` so copied projects use the newest published Action.
- Writes output under `dist/sprites/<model-name>/`.
- Uploads the generated sprites and run summary as the `sprite-assets` artifact.

The included `models/example.fbx` is just a smoke-test model so the template works immediately.

This template is also used by Sprite Sheet Helper's release pipeline before the floating Action refs are updated, so regressions in the published Docker Action path should fail the release smoke test.

## Customize Defaults

Edit `.github/workflows/generate-sprites.yml` and adjust the `SPRITE_*` environment values:

```yaml
env:
  SPRITE_FORMAT: spritesheet
  SPRITE_WORKFLOW: topdown-4dir
  SPRITE_FRAMES: "4"
  SPRITE_FPS: "10"
  SPRITE_WIDTH: "64"
  SPRITE_HEIGHT: "64"
  SPRITE_NORMAL_MAP: "true"
```

Useful formats include `spritesheet`, `love2d-lua`, `bevy`, `phaser`, `godot`, `pygame`, `raylib`, and `unity`.

## Folder Layout

```text
.
  .github/workflows/generate-sprites.yml
  models/
    example.fbx
  scripts/
    build-sprite-config.mjs
```

Generated files are ignored locally by `.gitignore`, but uploaded by CI as artifacts.

## Local Dry Run

You can inspect the generated config without running the Action:

```bash
node scripts/build-sprite-config.mjs
cat sprite-sheet-helper.generated.json
```
