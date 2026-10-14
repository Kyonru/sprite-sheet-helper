"""Capture the real add-on controls inside Blender for the UI demo video.

The panels are registered in Blender's already-active Item tab for this one
capture, allowing a non-interactive screenshot to show their contents. The
shipping add-on continues to use its dedicated Sprite Sheet tab.
"""

from __future__ import annotations

from pathlib import Path
import sys

import bpy


DEMO_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(DEMO_ROOT.parent))

import sprite_sheet_helper  # noqa: E402
from sprite_sheet_helper import ui  # noqa: E402


ui.SSH_PT_base.bl_category = "Item"
sprite_sheet_helper.register()

scene = bpy.context.scene
rig = bpy.data.objects.get("Hover Bot Rig")
action = bpy.data.actions.get("Hover Loop")
settings = scene.ssh_settings
settings.target_type = "ARMATURE"
settings.target_armature = rig
settings.workflow = "isometric"
settings.projection = "ORTHO"
settings.resolution_x = 128
settings.resolution_y = 128
settings.margin = 1.16
settings.transparent = True
settings.sampling_mode = "FRAME_COUNT"
settings.frame_count = 8
settings.fps = 8
settings.output_directory = str(DEMO_ROOT / "output")
settings.file_prefix = "hover-bot"
if not settings.actions and action is not None:
    item = settings.actions.add()
    item.action = action
    item.enabled = True
    item.use_custom_range = True
    item.frame_start = 1
    item.frame_end = 9

scene.frame_set(5)
if rig is not None:
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)

for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        area.spaces.active.show_region_ui = True
        area.spaces.active.shading.type = "RENDERED"

destination = DEMO_ROOT / "blender-controls.png"
bpy.ops.screen.screenshot(filepath=str(destination))
print(f"SSH_DEMO_CONTROLS_SCREENSHOT={destination}")
