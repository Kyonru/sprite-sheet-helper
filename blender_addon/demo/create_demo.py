"""Create and capture the animated hover-bot used by the add-on demo video.

Run with Blender, not the system Python:

    blender --background --factory-startup --python blender_addon/demo/create_demo.py
"""

from __future__ import annotations

from math import radians
from pathlib import Path
import sys

import bpy


DEMO_ROOT = Path(__file__).resolve().parent
ADDON_ROOT = DEMO_ROOT.parent
OUTPUT = DEMO_ROOT / "output"
sys.path.insert(0, str(ADDON_ROOT))

import sprite_sheet_helper  # noqa: E402


def material(name: str, color: tuple[float, float, float, float]):
    value = bpy.data.materials.new(name)
    value.diffuse_color = color
    return value


def finish_object(obj, name: str, color, bevel: float = 0.08):
    obj.name = name
    obj.data.materials.append(material(f"{name} Material", color))
    obj.color = color
    if bevel:
        modifier = obj.modifiers.new("Soft Edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    bpy.ops.object.shade_smooth_by_angle()
    return obj


def cube(name, location, scale, color, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(obj, name, color, bevel)


def sphere(name, location, scale, color):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(obj, name, color, 0.04)


def cylinder(name, location, radius, depth, color, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    return finish_object(bpy.context.object, name, color, 0.04)


def build_bot():
    blue = (0.07, 0.34, 0.80, 1.0)
    navy = (0.025, 0.08, 0.20, 1.0)
    cyan = (0.05, 0.95, 1.0, 1.0)
    orange = (1.0, 0.28, 0.04, 1.0)
    white = (0.78, 0.88, 1.0, 1.0)

    bpy.ops.object.armature_add(enter_editmode=False, location=(0.0, 0.0, 0.0))
    rig = bpy.context.object
    rig.name = "Hover Bot Rig"
    rig.show_in_front = True

    parts = [
        sphere("Body", (0.0, 0.0, 1.35), (0.68, 0.48, 0.62), blue),
        cube("Face", (0.0, -0.43, 1.47), (0.48, 0.08, 0.25), navy, 0.06),
        sphere("Eye Left", (-0.20, -0.525, 1.52), (0.10, 0.05, 0.10), cyan),
        sphere("Eye Right", (0.20, -0.525, 1.52), (0.10, 0.05, 0.10), cyan),
        cylinder("Antenna", (0.0, 0.0, 2.07), 0.045, 0.45, white),
        sphere("Antenna Light", (0.0, 0.0, 2.32), (0.12, 0.12, 0.12), orange),
        cylinder("Left Pod", (-0.76, 0.0, 1.25), 0.24, 0.34, navy, (0.0, radians(90), 0.0)),
        cylinder("Right Pod", (0.76, 0.0, 1.25), 0.24, 0.34, navy, (0.0, radians(90), 0.0)),
        cylinder("Thruster", (0.0, 0.0, 0.72), 0.34, 0.28, navy),
        sphere("Thruster Glow", (0.0, 0.0, 0.51), (0.25, 0.25, 0.16), orange),
        cube("Left Fin", (-0.62, 0.16, 0.88), (0.34, 0.18, 0.08), blue, 0.04),
        cube("Right Fin", (0.62, 0.16, 0.88), (0.34, 0.18, 0.08), blue, 0.04),
    ]
    for part in parts:
        part.parent = rig

    rig.rotation_mode = "XYZ"
    for frame, height, tilt in ((1, 0.0, -4.0), (5, 0.20, 4.0), (9, 0.0, -4.0)):
        rig.location.z = height
        rig.rotation_euler.z = radians(tilt)
        rig.keyframe_insert(data_path="location", frame=frame, index=2)
        rig.keyframe_insert(data_path="rotation_euler", frame=frame, index=2)
    action = rig.animation_data.action
    action.name = "Hover Loop"
    return rig, action


def configure_scene(scene):
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.fps = 24
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = "WORLD"
    scene.display.shading.curvature_ridge_factor = 1.5
    scene.display.shading.curvature_valley_factor = 1.0
    scene.view_settings.look = "AgX - Medium High Contrast"


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sprite_sheet_helper.register()
    try:
        rig, action = build_bot()
        scene = bpy.context.scene
        configure_scene(scene)
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
        settings.output_directory = str(OUTPUT)
        settings.file_prefix = "hover-bot"
        item = settings.actions.add()
        item.action = action
        item.enabled = True
        item.use_custom_range = True
        item.frame_start = 1
        item.frame_end = 9

        result = bpy.ops.ssh.render_sprites()
        if result != {"FINISHED"}:
            raise RuntimeError(f"Capture failed: {result}")
        bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "hover-bot-demo.blend"))
        print(f"SSH_DEMO_OUTPUT={OUTPUT}")
    finally:
        sprite_sheet_helper.unregister()


if __name__ == "__main__":
    main()
