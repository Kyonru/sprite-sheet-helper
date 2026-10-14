"""Camera workflow presets shared with the Sprite Sheet Helper application.

Angles intentionally match ``src/constants/workflows.ts``. ``phi`` is measured
down from Blender's positive Z axis and ``theta`` rotates clockwise around Z
when viewed from above; theta zero places the camera in front of the model
(negative Y).
"""

from __future__ import annotations

from dataclasses import dataclass
from math import cos, radians, sin
from typing import Final


@dataclass(frozen=True)
class Direction:
    """One named camera direction in degrees."""

    label: str
    phi: float
    theta: float


@dataclass(frozen=True)
class Workflow:
    """A reusable set of camera directions."""

    id: str
    label: str
    description: str
    directions: tuple[Direction, ...]


def _directions(*items: tuple[str, float, float]) -> tuple[Direction, ...]:
    return tuple(Direction(*item) for item in items)


WORKFLOWS: Final[tuple[Workflow, ...]] = (
    Workflow("topdown-8dir", "Top Down 8-directional", "Nearly-overhead camera at 8 cardinal and diagonal angles.", _directions(("N", 1, 0), ("NE", 1, 45), ("E", 1, 90), ("SE", 1, 135), ("S", 1, 180), ("SW", 1, 225), ("W", 1, 270), ("NW", 1, 315))),
    Workflow("topdown-4dir", "Top Down 4-directional", "Nearly-overhead camera at 4 cardinal angles.", _directions(("N", 1, 0), ("E", 1, 90), ("S", 1, 180), ("W", 1, 270))),
    Workflow("topdown-1dir", "Top Down Single Direction", "Nearly-overhead single direction; rotate the sprite in-game.", _directions(("Forward", 1, 0))),
    Workflow("isometric", "Isometric", "45 degree elevation at 4 diagonal angles.", _directions(("SE", 45, 45), ("NE", 45, 135), ("NW", 45, 225), ("SW", 45, 315))),
    Workflow("isometric-1dir", "Isometric Single Direction", "Single isometric corner; rotate the sprite in-game.", _directions(("SE", 45, 45))),
    Workflow("platformer", "Platformer / Side View", "Horizon-level right and left views.", _directions(("Right", 90, 90), ("Left", 90, 270))),
    Workflow("platformer-1dir", "Platformer Single Side", "Single side view; mirror the sprite in-game.", _directions(("Right", 90, 90))),
    Workflow("front-back-2dir", "Front & Back - RPG Style", "Horizon-level front and back views.", _directions(("Front", 90, 0), ("Back", 90, 180))),
    Workflow("three-quarter-4dir", "3/4 View 4-directional - Diablo Style", "45 degree elevation at 4 cardinal directions.", _directions(("N", 45, 0), ("E", 45, 90), ("S", 45, 180), ("W", 45, 270))),
    Workflow("three-quarter-8dir", "3/4 View 8-directional - Diablo Style", "45 degree elevation at 8 cardinal and diagonal angles.", _directions(("N", 45, 0), ("NE", 45, 45), ("E", 45, 90), ("SE", 45, 135), ("S", 45, 180), ("SW", 45, 225), ("W", 45, 270), ("NW", 45, 315))),
    Workflow("front-facing", "Front-Facing - Doom Style", "Horizon-level front-facing view.", _directions(("Front", 90, 0))),
    Workflow("profile-1dir", "Profile View Single", "Single pure side view; mirror the sprite in-game.", _directions(("Right", 90, 90))),
    Workflow("diagonal-4dir", "Diagonal Only 4-direction", "Nearly-overhead diagonal angles only.", _directions(("NE", 1, 45), ("SE", 1, 135), ("SW", 1, 225), ("NW", 1, 315))),
)

_BY_ID: Final = {workflow.id: workflow for workflow in WORKFLOWS}


def get_workflow(workflow_id: str) -> Workflow:
    """Return a preset by stable id, raising ``KeyError`` for unknown ids."""

    return _BY_ID[workflow_id]


def workflow_enum_items(_self=None, _context=None) -> list[tuple[str, str, str]]:
    """Return Blender-compatible enum items without importing ``bpy``."""

    return [(item.id, item.label, item.description) for item in WORKFLOWS]


def direction_vector(direction: Direction) -> tuple[float, float, float]:
    """Return the Blender-space unit vector from target toward the camera."""

    phi = radians(direction.phi)
    theta = radians(direction.theta)
    return (sin(phi) * sin(theta), -sin(phi) * cos(theta), cos(phi))
