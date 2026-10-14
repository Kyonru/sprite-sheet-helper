# Sprite Sheet Helper for Blender

Turn animated Blender assets into consistently framed, transparent sprite sheets without leaving Blender. The add-on samples Actions, renders each view, packs the frames into a PNG, and writes matching JSON metadata for game tooling.

## Demo

Run the reproducible [`demo/create_demo.py`](demo/create_demo.py) scene in
Blender to capture one Action as 32 transparent PNGs across four isometric
directions, then export the atlas and JSON:

```sh
blender --background --factory-startup --python blender_addon/demo/create_demo.py
```

Generated recordings and screenshots are local test evidence and are not
tracked in the repository.

## Requirements

- Blender 4.2 or newer for the Extension package
- A saved `.blend` file is strongly recommended before long captures
- An armature with Actions, or a collection containing the objects to render

## Install

### Blender 4.2+

1. Download the `sprite-sheet-helper-*-extension.zip` release. Do not extract it.
2. In Blender, open **Edit → Preferences → Get Extensions**.
3. Open the menu in the upper-right, choose **Install from Disk**, and select the ZIP.
4. Enable **Sprite Sheet Helper** if Blender does not enable it automatically.

For older installation flows, use the `*-legacy.zip` archive with **Preferences → Add-ons → Install from Disk**.

For development, add this repository's `blender_addon/sprite_sheet_helper` directory as a Blender extension source or install a freshly built archive:

```sh
python3 blender_addon/package_addon.py
```

The script writes Extension and legacy archives to `blender_addon/dist/`. Use `--format extension` or `--format legacy` to build only one layout.
It also verifies that the Extension manifest and legacy `bl_info` versions match, and produces reproducible archives containing this README and the project license.

## First capture

1. Open the **3D View**, press `N`, and choose the **Sprite Sheet** tab.
2. Pick a workflow preset.
3. Choose an armature or collection as the target.
4. Select the camera projection and output resolution.
5. Click **Find Actions**, then enable the animations to export. Per-action frame ranges are optional.
6. Choose FPS sampling or a fixed frame count.
7. Select an output folder and filename prefix.
8. Click **Render Sprite Sheet**.

The output folder receives a PNG atlas plus JSON describing the animations and frame rectangles. Existing scene render settings are restored after capture.

## MVP scope and limitations

This first Blender-native release focuses on a dependable capture loop:

- Actions must be compatible with the selected armature or collection.
- Camera framing is automatic; manual framing overrides are not yet exposed.
- Output uses a deterministic row-based atlas rather than packed/trimmed layouts.
- A single color sprite sheet and JSON metadata are exported. Normal maps and engine-specific formats are not yet included.
- Blender materials, lighting, world settings, and render engine determine the final appearance.
- Captures run synchronously. Large resolutions, many directions, or many Actions can keep Blender busy for a while.
- Pose authoring, material editing, and post-processing remain Blender workflows rather than duplicated add-on tools.

## Troubleshooting

- **No actions appear:** select the intended armature, confirm its animation Actions exist in the file, then click **Find Actions**.
- **The button is disabled:** resolve each message shown above **Render Sprite Sheet**. A target, output folder, and at least one enabled Action are required.
- **Sprites are clipped:** increase the framing margin, and check for animated geometry outside the target collection.
- **Output looks different from the viewport:** capture uses Blender's render result, so check the active render engine, lights, world, color management, and material render visibility.
- **Installation fails:** make sure you selected the intact ZIP matching your Blender installation flow, not the source repository archive.

## Release packaging

Update the version in `sprite_sheet_helper/blender_manifest.toml`, then run:

```sh
python3 blender_addon/package_addon.py
```

Before publishing, install the resulting Extension ZIP in a clean Blender profile and complete one armature and one collection capture.
