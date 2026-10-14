"""Open the captured hover-bot scene with the add-on sidebar ready to inspect."""

from __future__ import annotations

from pathlib import Path
import sys

import bpy


ADDON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ADDON_ROOT))

import sprite_sheet_helper  # noqa: E402


def configure_ui() -> None:
    try:
        sprite_sheet_helper.register()
    except ValueError:
        # Blender may already have enabled the installed package.
        pass

    scene = bpy.context.scene
    rig = bpy.data.objects.get("Hover Bot Rig")
    action = bpy.data.actions.get("Hover Loop")
    if rig is not None:
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
    scene.frame_set(5)

    settings = scene.ssh_settings
    settings.target_type = "ARMATURE"
    settings.target_armature = rig
    settings.workflow = "isometric"
    settings.projection = "ORTHO"
    settings.resolution_x = 128
    settings.resolution_y = 128
    settings.sampling_mode = "FRAME_COUNT"
    settings.frame_count = 8
    settings.fps = 8
    settings.file_prefix = "hover-bot"
    settings.output_directory = str(Path(__file__).resolve().parent / "output")
    if not settings.actions and action is not None:
        item = settings.actions.add()
        item.action = action
        item.enabled = True
        item.use_custom_range = True
        item.frame_start = 1
        item.frame_end = 9

    for area in bpy.context.screen.areas:
        if area.type != "VIEW_3D":
            continue
        space = area.spaces.active
        space.show_region_ui = True
        space.shading.type = "RENDERED"
        window_region = next(
            (region for region in area.regions if region.type == "WINDOW"), None
        )
        if window_region is not None:
            with bpy.context.temp_override(area=area, region=window_region, space_data=space):
                bpy.ops.view3d.view_all(center=True)

    print("SSH_DEMO_UI_READY")


def capture_ui() -> None:
    """Capture Blender's own window after panels have finished laying out."""

    destination = Path(__file__).resolve().parent / "blender-integration.png"
    bpy.ops.screen.screenshot(filepath=str(destination))
    print(f"SSH_DEMO_UI_SCREENSHOT={destination}")


configure_ui()
capture_ui()
