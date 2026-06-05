# Sprite Sheet Helper Action

Generate sprite sheets, normal-map atlases, and engine-ready asset packages from 3D models in GitHub Actions.

This action wraps the Sprite Sheet Helper Docker image, so workflows do not need to install Node, Chromium, or app dependencies.

## Basic Usage

```yaml
- name: Generate sprites
  uses: Kyonru/sprite-sheet-helper/action@v0
  with:
    input: assets/hero.glb
    output: dist/sprites
    workflow: topdown-4dir
    format: spritesheet
```

## Batch Config

For repeatable asset pipelines, keep a config file in your repo and run it from the action:

```yaml
- name: Generate sprite batch
  id: sprites
  uses: Kyonru/sprite-sheet-helper/action@v0
  with:
    config: sprites.config.json
    fail-on-warnings: "true"

- name: Upload sprites
  uses: actions/upload-artifact@v6
  with:
    name: sprites
    path: dist/sprites/
```

## Inputs

| Input | Description |
| --- | --- |
| `input` | Model file to export. Omit when using a config with jobs. |
| `output` | Output directory for generated files. |
| `config` | JSON batch config path. |
| `job` | Job id to run from a config file. |
| `format` | Export format, such as `spritesheet`, `godot`, `love2d-lua`, `bevy`, or `phaser`. |
| `workflow` | Workflow preset id, such as `topdown-4dir` or `isometric`. |
| `frames` | Frames per captured sequence. |
| `fps` | Capture frames per second. |
| `width` | Frame width in pixels. |
| `height` | Frame height in pixels. |
| `normal-map` | Capture and export normal maps. |
| `atlas-layout` | Atlas layout, `rows` or `packed`. |
| `atlas-padding` | Empty pixels around each frame slot. |
| `atlas-bleed` | Edge-pixel extrusion around each frame. |
| `atlas-scale` | Atlas scale factor. |
| `max-atlas-size` | Maximum atlas page width and height. |
| `multi-page` | Allow generic spritesheet page splitting. |
| `json` | Print the CLI JSON summary to stdout. |
| `fail-on-warnings` | Fail the action when the CLI reports warnings. |
| `args` | Extra CLI arguments appended after the mapped inputs. |

## Outputs

| Output | Description |
| --- | --- |
| `status` | CLI summary status. |
| `summary-json` | Full machine-readable CLI summary. |
| `files` | Newline-delimited generated files. |
| `warnings` | Newline-delimited warnings. |
| `elapsed-ms` | Total elapsed time in milliseconds. |

## Local Testing With act

The action is Docker-based, so it can be smoke-tested locally with [`act`](https://github.com/nektos/act):

```bash
act -j docker-smoke
```

On Apple Silicon, add:

```bash
act --container-architecture linux/amd64 -j docker-smoke
```

`act` is useful for local feedback, but GHCR publishing, token permissions, release tags, and GitHub Pages deployment should still be verified on GitHub Actions.

## Docker Image

The action runs:

```text
ghcr.io/kyonru/sprite-sheet-helper:v0
```

Release tags like `v0.4.0` publish Docker image tags `v0.4.0`, `v0.4`, `v0`, and `latest`. After the Docker action smoke test passes, CI also updates the floating GitHub Action refs `v0.4`, `v0`, and `latest`. Branch builds do not update published image tags or action refs.

You can use the same image directly:

```bash
docker run --rm \
  -v "$PWD:/work" \
  ghcr.io/kyonru/sprite-sheet-helper:v0 \
  /work/assets/hero.glb \
  --workflow topdown-4dir \
  --output /work/dist/sprites
```
