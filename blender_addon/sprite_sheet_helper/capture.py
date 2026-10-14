"""Deterministic Action sampling and transparent PNG sequence rendering."""

from __future__ import annotations

from contextlib import AbstractContextManager
from dataclasses import dataclass
from math import floor
from pathlib import Path
import re

import bpy
from bpy.types import Operator
from mathutils import Vector

from .camera import create_camera, evaluated_bounds, fit_camera, remove_camera
from .properties import enabled_action_items, get_settings, resolve_target
from .workflows import Direction, get_workflow


@dataclass(frozen=True)
class RenderedFrame:
    """One rendered cell, suitable for atlas and metadata builders."""

    action: str
    direction: str
    frame_index: int
    source_frame: float
    path: Path


@dataclass(frozen=True)
class CaptureResult:
    """Ordered output from a complete capture."""

    frames: tuple[RenderedFrame, ...]
    width: int
    height: int
    fps: float
    workflow: str
    output_directory: Path


def build_sprite_sheet(result: CaptureResult, file_prefix: str = "sprite"):
    """Build and write a row atlas from a capture result.

    Importing the Blender-neutral atlas implementation lazily keeps this module
    cheap to load and gives headless callers the option to consume raw frames.
    Each action/direction pair is one deterministic atlas row.
    """

    from .atlas import AnimationRow, build_atlas, write_atlas_pages

    grouped: dict[tuple[str, str], list[RenderedFrame]] = {}
    for frame in result.frames:
        grouped.setdefault((frame.action, frame.direction), []).append(frame)
    workflow = get_workflow(result.workflow)
    rows = tuple(
        AnimationRow(
            name=f"{slugify(action)}_{slugify(direction)}",
            frames=tuple(frame.path for frame in frames),
            fps=result.fps,
            workflow={
                "workflowId": result.workflow,
                "workflowLabel": workflow.label,
                "animationName": action,
                "directionLabel": direction,
            },
        )
        for (action, direction), frames in grouped.items()
    )
    image_name = f"{slugify(file_prefix)}.png"
    return write_atlas_pages(build_atlas(rows), result.output_directory, image_name)


def write_sprite_sheet_metadata(result: CaptureResult, atlas_build, file_prefix: str = "sprite") -> Path:
    """Write generic JSON metadata beside a completed atlas build."""

    from .metadata import create_spritesheet_metadata, output_file_names, write_json_atomic

    names = output_file_names(file_prefix)
    document = create_spritesheet_metadata(
        atlas_build.rows,
        atlas_build.plan,
        image_name=names["image"],
    )
    return write_json_atomic(result.output_directory / names["metadata"], document)


def slugify(value: str) -> str:
    """Convert a Blender label to a deterministic, filesystem-safe token."""

    token = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip("-._").lower()
    return token or "unnamed"


def action_frame_range(item) -> tuple[float, float]:
    """Resolve a configured Action range in ascending order."""

    start, end = (item.frame_start, item.frame_end) if item.use_custom_range else item.action.frame_range
    return (float(min(start, end)), float(max(start, end)))


def sample_frames(item, scene_fps: float, sampling_mode: str, output_fps: float, frame_count: int) -> tuple[float, ...]:
    """Produce deterministic samples over the configured Action range.

    FPS mode advances by an exact scene-FPS/output-FPS interval and does not
    distort timing merely to land on the final keyframe. Exact-count mode
    distributes samples evenly and includes both endpoints.
    """

    start, end = action_frame_range(item)
    if end <= start:
        return (start,)
    if sampling_mode == "FRAME_COUNT":
        count = max(1, int(frame_count))
        if count == 1:
            return (start,)
        step = (end - start) / (count - 1)
        return tuple(start + step * index for index in range(count))
    step = max(scene_fps, 1e-6) / max(output_fps, 1e-6)
    count = max(1, floor((end - start) / step + 1e-9) + 1)
    return tuple(start + step * index for index in range(count))


def set_scene_frame(scene: bpy.types.Scene, value: float) -> None:
    """Set an integer frame plus deterministic fractional subframe."""

    base = floor(value)
    scene.frame_set(base, subframe=value - base)


class CaptureSession(AbstractContextManager):
    """Snapshot mutable Blender state and restore it even after render errors."""

    def __init__(
        self,
        scene: bpy.types.Scene,
        armature: bpy.types.Object | None,
        render_objects: list[bpy.types.Object],
    ):
        self.scene = scene
        self.armature = armature
        self.render_objects = render_objects
        self.camera = None

    def __enter__(self):
        render = self.scene.render
        image = render.image_settings
        self.snapshot = {
            "camera": self.scene.camera,
            "frame": self.scene.frame_current,
            "subframe": self.scene.frame_subframe,
            "filepath": render.filepath,
            "resolution_x": render.resolution_x,
            "resolution_y": render.resolution_y,
            "resolution_percentage": render.resolution_percentage,
            "film_transparent": render.film_transparent,
            "file_format": image.file_format,
            "color_mode": image.color_mode,
            "had_animation_data": bool(self.armature and self.armature.animation_data),
            "action": self.armature.animation_data.action if self.armature and self.armature.animation_data else None,
            "hide_render": tuple((obj, obj.hide_render) for obj in self.scene.objects),
        }
        target_objects = set(self.render_objects)
        for obj in self.scene.objects:
            # Scene lighting remains available even when it lives outside the
            # selected target. Other visible geometry is isolated so it cannot
            # leak into an atlas that claims to represent the chosen target.
            if obj not in target_objects and obj.type not in {"LIGHT", "LIGHT_PROBE"}:
                obj.hide_render = True
        self.camera = create_camera(self.scene)
        self.scene.camera = self.camera
        return self


    def __exit__(self, exc_type, exc_value, traceback):
        render = self.scene.render
        image = render.image_settings
        if self.armature and self.snapshot["had_animation_data"] and self.armature.animation_data:
            self.armature.animation_data.action = self.snapshot["action"]
        elif self.armature and self.armature.animation_data:
            # Assigning the first captured Action creates animation data. Put
            # an originally unanimated target back exactly as we found it.
            self.armature.animation_data_clear()
        self.scene.camera = self.snapshot["camera"]
        self.scene.frame_set(self.snapshot["frame"], subframe=self.snapshot["subframe"])
        render.filepath = self.snapshot["filepath"]
        render.resolution_x = self.snapshot["resolution_x"]
        render.resolution_y = self.snapshot["resolution_y"]
        render.resolution_percentage = self.snapshot["resolution_percentage"]
        render.film_transparent = self.snapshot["film_transparent"]
        image.file_format = self.snapshot["file_format"]
        image.color_mode = self.snapshot["color_mode"]
        for obj, hidden in self.snapshot["hide_render"]:
            try:
                obj.hide_render = hidden
            except ReferenceError:
                pass
        remove_camera(self.camera)
        return False


def _assign_action(armature: bpy.types.Object, action: bpy.types.Action) -> None:
    if armature.animation_data is None:
        armature.animation_data_create()
    armature.animation_data.action = action


def capture(context: bpy.types.Context, settings=None) -> CaptureResult:
    """Render configured Actions and directions, returning ordered frame records.

    This function is the main non-operator API for UI, tests, and exporters.
    Raw frames are laid out as ``frames/<action>/<direction>/<index>.png`` below
    the configured output directory. Atlas creation can consume ``result.frames``.
    """

    scene = context.scene
    settings = settings or get_settings(scene)
    armature, objects = resolve_target(context, settings)
    if armature is None:
        raise ValueError("Choose an armature, or a collection containing an armature")
    if not objects:
        raise ValueError("The selected target contains no objects")
    action_items = enabled_action_items(settings)
    if not action_items:
        raise ValueError("Enable at least one Action")
    workflow = get_workflow(settings.workflow)
    output_root = Path(bpy.path.abspath(settings.output_directory)).resolve()
    frames_root = output_root / "frames"
    scene_fps = scene.render.fps / max(scene.render.fps_base, 1e-6)
    rendered: list[RenderedFrame] = []

    with CaptureSession(scene, armature, objects) as session:
        render = scene.render
        render.resolution_x = settings.resolution_x
        render.resolution_y = settings.resolution_y
        render.resolution_percentage = 100
        render.film_transparent = settings.transparent
        render.image_settings.file_format = "PNG"
        render.image_settings.color_mode = "RGBA" if settings.transparent else "RGB"

        for item in action_items:
            action = item.action
            _assign_action(armature, action)
            samples = sample_frames(item, scene_fps, settings.sampling_mode, settings.fps, settings.frame_count)
            action_name = slugify(action.name)
            for direction in workflow.directions:
                all_points: list[Vector] = []
                for source_frame in samples:
                    set_scene_frame(scene, source_frame)
                    context.view_layer.update()
                    all_points.extend(evaluated_bounds(context, objects))
                fit_camera(session.camera, all_points, direction, settings.resolution_x, settings.resolution_y, settings.margin, settings.projection)
                direction_name = slugify(direction.label)
                destination = frames_root / action_name / direction_name
                destination.mkdir(parents=True, exist_ok=True)
                for index, source_frame in enumerate(samples):
                    set_scene_frame(scene, source_frame)
                    context.view_layer.update()
                    path = destination / f"{index:04d}.png"
                    render.filepath = str(path)
                    bpy.ops.render.render(write_still=True)
                    rendered.append(RenderedFrame(action.name, direction.label, index, source_frame, path))

    return CaptureResult(tuple(rendered), settings.resolution_x, settings.resolution_y, settings.fps, workflow.id, output_root)


class SSH_OT_render_sprites(Operator):
    bl_idname = "ssh.render_sprites"
    bl_label = "Render Sprite Sheet"
    bl_description = "Render deterministic transparent PNG frames for the selected Actions"

    def execute(self, context):
        try:
            result = capture(context)
            prefix = get_settings(context.scene).file_prefix
            atlas = build_sprite_sheet(result, prefix)
            metadata_path = write_sprite_sheet_metadata(result, atlas, prefix)
        except (ValueError, KeyError, OSError, RuntimeError) as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Rendered {len(result.frames)} frames, {len(atlas.files)} sheet(s), and {metadata_path.name}")
        return {"FINISHED"}


CLASSES = (SSH_OT_render_sprites,)
