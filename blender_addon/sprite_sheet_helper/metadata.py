"""Stable metadata for Blender-rendered sprite atlases.

The public JSON shape mirrors Sprite Sheet Helper's generic spritesheet export:
``meta``, ``animations[*].quads``, and optional ``directionalAnimations``.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import tempfile
from typing import Any, Mapping, Sequence

try:  # Package import.
    from .atlas import AnimationRow, AtlasError, AtlasPlan, atlas_page_file_name
except ImportError:  # Direct module loading in small external scripts.
    from atlas import AnimationRow, AtlasError, AtlasPlan, atlas_page_file_name  # type: ignore


WORKFLOW_FIELDS = (
    "workflowId",
    "workflowLabel",
    "animationName",
    "directionLabel",
)


def iso_timestamp(value: datetime | str | None = None) -> str:
    """Return a UTC ISO-8601 timestamp with JavaScript-compatible ``Z``."""

    if value is None:
        value = datetime.now(timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise AtlasError(f"Invalid exportedAt timestamp {value!r}") from exc
        value = parsed
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    value = value.astimezone(timezone.utc)
    rendered = value.isoformat(timespec="milliseconds")
    return rendered[:-6] + "Z"


def normalize_workflow(workflow: Mapping[str, Any] | None) -> dict[str, str] | None:
    if workflow is None:
        return None
    if not isinstance(workflow, Mapping):
        raise AtlasError("workflow metadata must be a mapping")
    normalized: dict[str, str] = {}
    for field in WORKFLOW_FIELDS:
        value = workflow.get(field)
        if not isinstance(value, str) or not value.strip():
            raise AtlasError(f"workflow.{field} must be a non-empty string")
        normalized[field] = value
    model_uuid = workflow.get("modelUuid")
    if model_uuid is not None:
        if not isinstance(model_uuid, str) or not model_uuid.strip():
            raise AtlasError("workflow.modelUuid must be a non-empty string when present")
        normalized["modelUuid"] = model_uuid
    # Preserve the desktop contract's field order.
    return {
        "workflowId": normalized["workflowId"],
        "workflowLabel": normalized["workflowLabel"],
        **({"modelUuid": normalized["modelUuid"]} if "modelUuid" in normalized else {}),
        "animationName": normalized["animationName"],
        "directionLabel": normalized["directionLabel"],
    }


def build_directional_animation_groups(rows: Sequence[AnimationRow]) -> list[dict[str, Any]]:
    """Group workflow rows while preserving first-seen row and direction order."""

    groups: dict[tuple[str, str, str], dict[str, Any]] = {}
    for row in rows:
        workflow = normalize_workflow(row.workflow)
        if workflow is None:
            continue
        key = (
            workflow["workflowId"],
            workflow.get("modelUuid", ""),
            workflow["animationName"],
        )
        direction = {"label": workflow["directionLabel"], "animation": row.name}
        if key in groups:
            groups[key]["directions"].append(direction)
        else:
            groups[key] = {
                "name": workflow["animationName"],
                "workflowId": workflow["workflowId"],
                "workflowLabel": workflow["workflowLabel"],
                **({"modelUuid": workflow["modelUuid"]} if "modelUuid" in workflow else {}),
                "directions": [direction],
            }
    return [
        group
        for group in groups.values()
        if len({direction["label"] for direction in group["directions"]}) > 1
    ]


def _placements(plan: AtlasPlan) -> dict[tuple[int, int], Any]:
    result: dict[tuple[int, int], Any] = {}
    for placement in plan.placements:
        key = (placement.row_index, placement.frame_index)
        if key in result:
            raise AtlasError(f"Duplicate atlas placement for row/frame {key}")
        result[key] = placement
    return result


def _fps(row: AnimationRow) -> int | float:
    value = float(row.fps)
    if not math.isfinite(value) or value <= 0:
        return 12
    return int(value) if value.is_integer() else value


def validate_plan(rows: Sequence[AnimationRow], plan: AtlasPlan) -> None:
    if not plan.pages:
        raise AtlasError("Atlas plan has no pages")
    indices = [page.index for page in plan.pages]
    if indices != list(range(len(plan.pages))):
        raise AtlasError("Atlas page indices must be contiguous and zero-based")
    placements = _placements(plan)
    expected = sum(len(row.frames) for row in rows)
    if len(placements) != expected:
        raise AtlasError(f"Atlas has {len(placements)} placements; expected {expected}")
    for row_index, row in enumerate(rows):
        for frame_index in range(len(row.frames)):
            placement = placements.get((row_index, frame_index))
            if placement is None:
                raise AtlasError(f"Missing atlas placement for {row.name}:{frame_index}")
            if not 0 <= placement.page < len(plan.pages):
                raise AtlasError(f"Invalid page for {row.name}:{frame_index}")
            page = plan.pages[placement.page]
            if (
                placement.x < 0
                or placement.y < 0
                or placement.w < 1
                or placement.h < 1
                or placement.x + placement.w > page.width
                or placement.y + placement.h > page.height
            ):
                raise AtlasError(f"Placement is outside its page for {row.name}:{frame_index}")


def create_spritesheet_metadata(
    rows: Sequence[AnimationRow],
    plan: AtlasPlan,
    image_name: str = "spritesheet.png",
    normal_image_name: str | None = None,
    exported_at: datetime | str | None = None,
) -> dict[str, Any]:
    """Create generic spritesheet JSON compatible with the desktop app."""

    validate_plan(rows, plan)
    placements = _placements(plan)
    multi_page = len(plan.pages) > 1
    first_page = plan.pages[0]
    meta: dict[str, Any] = {
        "version": "1.0",
        "exportedAt": iso_timestamp(exported_at),
        "imageWidth": first_page.width,
        "imageHeight": first_page.height,
        "frameCount": sum(len(row.frames) for row in rows),
        "animationCount": len(rows),
        "spacing": plan.options.padding * 2 + plan.options.extrude * 2,
        "margin": plan.options.sprite_margin,
    }
    if normal_image_name:
        meta["normalImage"] = normal_image_name
    if multi_page:
        meta["pages"] = [
            {
                "index": page.index,
                "image": atlas_page_file_name(image_name, page.index),
                "width": page.width,
                "height": page.height,
                **(
                    {"normalImage": atlas_page_file_name(normal_image_name, page.index)}
                    if normal_image_name
                    else {}
                ),
            }
            for page in plan.pages
        ]
    animations: list[dict[str, Any]] = []
    for row_index, row in enumerate(rows):
        workflow = normalize_workflow(row.workflow)
        row_placements = [placements[(row_index, index)] for index in range(len(row.frames))]
        first = row_placements[0]
        animation = {
            "name": row.name,
            "frames": len(row.frames),
            "fps": _fps(row),
            "frameWidth": first.w,
            "frameHeight": first.h,
            **({"workflow": workflow} if workflow else {}),
            "quads": [
                {
                    "x": placement.x,
                    "y": placement.y,
                    "w": placement.w,
                    "h": placement.h,
                    **({"page": placement.page} if multi_page else {}),
                }
                for placement in row_placements
            ],
        }
        animations.append(animation)
    result: dict[str, Any] = {"meta": meta, "animations": animations}
    directional = build_directional_animation_groups(rows)
    if directional:
        result["directionalAnimations"] = directional
    return result


def create_manifest(
    rows: Sequence[AnimationRow],
    plan: AtlasPlan,
    image_name: str = "spritesheet.png",
    normal_image_name: str | None = None,
    exported_at: datetime | str | None = None,
    sheet_name: str | None = None,
) -> dict[str, Any]:
    """Create the richer shared atlas manifest used by app exporters."""

    validate_plan(rows, plan)
    timestamp = iso_timestamp(exported_at)
    placements = _placements(plan)
    pages = [
        {
            "index": page.index,
            "image": atlas_page_file_name(image_name, page.index),
            **(
                {"normalImage": atlas_page_file_name(normal_image_name, page.index)}
                if normal_image_name
                else {}
            ),
            "width": page.width,
            "height": page.height,
        }
        for page in plan.pages
    ]
    animations: list[dict[str, Any]] = []
    for row_index, row in enumerate(rows):
        workflow = normalize_workflow(row.workflow)
        first = placements[(row_index, 0)]
        animations.append(
            {
                "name": row.name,
                "fps": _fps(row),
                "frameWidth": first.w - plan.options.sprite_margin * 2,
                "frameHeight": first.h - plan.options.sprite_margin * 2,
                **({"workflow": workflow} if workflow else {}),
                "frames": [
                    {
                        "index": frame_index,
                        "page": (placement := placements[(row_index, frame_index)]).page,
                        "image": atlas_page_file_name(image_name, placement.page),
                        **(
                            {"normalImage": atlas_page_file_name(normal_image_name, placement.page)}
                            if normal_image_name
                            else {}
                        ),
                        "rect": {"x": placement.x, "y": placement.y, "w": placement.w, "h": placement.h},
                        "slot": {
                            "x": placement.slot_x,
                            "y": placement.slot_y,
                            "w": placement.slot_w,
                            "h": placement.slot_h,
                        },
                        "source": {
                            "width": max(1, round((placement.w - plan.options.sprite_margin * 2) / plan.options.scale)),
                            "height": max(1, round((placement.h - plan.options.sprite_margin * 2) / plan.options.scale)),
                        },
                    }
                    for frame_index in range(len(row.frames))
                ],
            }
        )
    result: dict[str, Any] = {
        "version": "1.0",
        "generatedBy": "sprite-sheet-helper-blender",
        "exportedAt": timestamp,
        "exporterId": "spritesheet",
        "sheet": sheet_name or Path(image_name).stem,
        "sourceFormat": "blender-rendered-frames",
        "atlas": {
            "layout": plan.options.layout,
            "padding": plan.options.padding,
            "extrude": plan.options.extrude,
            "scale": plan.options.scale,
            "maxAtlasSize": plan.options.max_atlas_size,
            "allowMultiPage": plan.options.allow_multi_page,
            "pageCount": len(pages),
            "pages": pages,
        },
        "animations": animations,
    }
    directional = build_directional_animation_groups(rows)
    if directional:
        result["directionalAnimations"] = directional
    return result


def json_text(document: Mapping[str, Any]) -> str:
    """Serialize in the repository's human-readable, stable JSON style."""

    return json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def write_json_atomic(path: str | os.PathLike[str], document: Mapping[str, Any]) -> Path:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    encoded = json_text(document).encode("utf-8")
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent
    )
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, destination)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise
    return destination


def safe_file_stem(value: str, fallback: str = "spritesheet") -> str:
    """Create a deterministic, portable output stem from a user-facing name."""

    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip(".-_").lower()
    stem = re.sub(r"-+", "-", stem)
    return stem or fallback


def output_file_names(name: str = "spritesheet") -> dict[str, str]:
    stem = safe_file_stem(name)
    return {
        "image": f"{stem}.png",
        "metadata": f"{stem}.json",
        "manifest": f"{stem}.manifest.json",
    }


__all__ = [
    "build_directional_animation_groups", "create_manifest",
    "create_spritesheet_metadata", "iso_timestamp", "json_text",
    "normalize_workflow", "output_file_names", "safe_file_stem",
    "validate_plan", "write_json_atomic",
]
