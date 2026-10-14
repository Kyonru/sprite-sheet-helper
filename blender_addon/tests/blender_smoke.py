"""Headless Blender smoke test for registration and end-to-end capture.

Run with:

    blender --background --factory-startup --python blender_addon/tests/blender_smoke.py
"""

from __future__ import annotations

import json
from pathlib import Path
import sys
import tempfile

import bpy


ADDON_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ADDON_ROOT))

import sprite_sheet_helper  # noqa: E402


def build_scene() -> tuple[bpy.types.Object, bpy.types.Action]:
    """Create a tiny animated target without relying on a fixture blend file."""

    bpy.ops.object.armature_add(enter_editmode=False, location=(0.0, 0.0, 0.0))
    armature = bpy.context.object
    armature.name = "Smoke Armature"

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 1.0))
    mesh = bpy.context.object
    mesh.name = "Smoke Mesh"
    mesh.parent = armature

    armature.location.x = 0.0
    armature.keyframe_insert(data_path="location", frame=1)
    armature.location.x = 0.25
    armature.keyframe_insert(data_path="location", frame=2)
    action = armature.animation_data.action
    action.name = "Idle Smoke"
    return armature, action


def main() -> None:
    sprite_sheet_helper.register()
    try:
        armature, action = build_scene()
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_WORKBENCH"
        settings = scene.ssh_settings
        settings.target_type = "ARMATURE"
        settings.target_armature = armature
        settings.workflow = "front-facing"
        settings.projection = "ORTHO"
        settings.resolution_x = 16
        settings.resolution_y = 16
        settings.sampling_mode = "FRAME_COUNT"
        settings.frame_count = 2
        settings.output_directory = tempfile.mkdtemp(prefix="ssh-blender-smoke-")
        settings.file_prefix = "smoke"

        item = settings.actions.add()
        item.action = action
        item.enabled = True

        result = bpy.ops.ssh.render_sprites()
        assert result == {"FINISHED"}, result

        output = Path(settings.output_directory)
        atlas = output / "smoke.png"
        metadata = output / "smoke.json"
        raw_frames = sorted((output / "frames").rglob("*.png"))
        assert atlas.is_file() and atlas.stat().st_size > 0
        assert metadata.is_file() and metadata.stat().st_size > 0
        assert len(raw_frames) == 2, raw_frames

        document = json.loads(metadata.read_text(encoding="utf-8"))
        assert document["meta"]["frameCount"] == 2
        assert document["animations"][0]["name"] == "idle-smoke_front"
        assert document["animations"][0]["workflow"]["workflowId"] == "front-facing"
        print(f"BLENDER_SMOKE_OK={output}")
    finally:
        sprite_sheet_helper.unregister()


if __name__ == "__main__":
    main()
