"""Camera placement and stable multi-frame auto-framing utilities."""

from __future__ import annotations

import bpy
from math import atan, tan
from mathutils import Vector

from .workflows import Direction, direction_vector


def create_camera(scene: bpy.types.Scene, name: str = "SSH Capture Camera") -> bpy.types.Object:
    """Create and link a temporary camera owned by the caller."""

    data = bpy.data.cameras.new(name)
    camera = bpy.data.objects.new(name, data)
    scene.collection.objects.link(camera)
    return camera


def remove_camera(camera: bpy.types.Object | None) -> None:
    """Remove a camera object and its data if they still exist."""

    if camera is None or camera.name not in bpy.data.objects:
        return
    data = camera.data
    bpy.data.objects.remove(camera, do_unlink=True)
    if data and data.users == 0:
        bpy.data.cameras.remove(data)


def evaluated_bounds(context: bpy.types.Context, objects: list[bpy.types.Object]) -> list[Vector]:
    """Get world-space evaluated bounding-box corners for renderable objects."""

    depsgraph = context.evaluated_depsgraph_get()
    points: list[Vector] = []
    for source in objects:
        # Armatures, empties, and helpers have bounds but do not contribute
        # visible pixels. Including them makes otherwise tight sprite framing
        # depend on rig display size or control objects.
        if source.hide_render or source.type in {
            "ARMATURE",
            "CAMERA",
            "EMPTY",
            "LATTICE",
            "LIGHT",
            "LIGHT_PROBE",
            "SPEAKER",
        }:
            continue
        obj = source.evaluated_get(depsgraph)
        if not getattr(obj, "bound_box", None):
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    return points


def aim_camera(camera: bpy.types.Object, direction: Direction, target: Vector, distance: float = 10.0) -> None:
    """Orient a camera toward target from a workflow direction."""

    outward = Vector(direction_vector(direction)).normalized()
    camera.location = target + outward * distance
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def fit_camera(
    camera: bpy.types.Object,
    points: list[Vector],
    direction: Direction,
    resolution_x: int,
    resolution_y: int,
    margin: float = 1.1,
    projection: str = "ORTHO",
) -> None:
    """Fit all supplied points while keeping the camera stable between frames."""

    if not points:
        raise ValueError("The target has no renderable bounds")
    center = sum(points, Vector()) / len(points)
    aim_camera(camera, direction, center, 10.0)
    rotation_inverse = camera.rotation_euler.to_matrix().transposed()
    local = [rotation_inverse @ (point - center) for point in points]
    min_x, max_x = min(p.x for p in local), max(p.x for p in local)
    min_y, max_y = min(p.y for p in local), max(p.y for p in local)
    min_z, max_z = min(p.z for p in local), max(p.z for p in local)
    width = max(max_x - min_x, 1e-4)
    height = max(max_y - min_y, 1e-4)
    aspect = max(float(resolution_x) / max(resolution_y, 1), 1e-4)
    outward = Vector(direction_vector(direction)).normalized()
    if projection == "ORTHO":
        camera.data.type = "ORTHO"
        camera.data.ortho_scale = max(height, width / aspect) * margin
        distance = max(max_z - min_z, width, height, 1.0) * 2.0
    else:
        camera.data.type = "PERSP"
        fov_y = camera.data.angle_y
        fov_x = 2.0 * atan(tan(fov_y / 2.0) * aspect)
        distance = max((height * 0.5 * margin) / tan(fov_y / 2.0), (width * 0.5 * margin) / tan(fov_x / 2.0))
        distance += max(abs(min_z), abs(max_z))
    camera.location = center + outward * max(distance, 0.01)
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.clip_start = max(0.001, distance / 10000.0)
    camera.data.clip_end = max(1000.0, distance * 100.0)
