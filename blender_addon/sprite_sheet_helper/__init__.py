"""Sprite Sheet Helper Blender add-on."""

from __future__ import annotations

bl_info = {
    "name": "Sprite Sheet Helper",
    "author": "Sprite Sheet Helper contributors",
    "version": (0, 1, 0),
    "blender": (4, 2, 0),
    "location": "View3D > Sidebar > Sprite Sheet Helper",
    "description": "Render animated models into directional sprite sheets",
    "category": "Render",
}

try:
    import bpy
    from bpy.props import PointerProperty
except ModuleNotFoundError:  # Allow pure atlas/metadata imports outside Blender.
    bpy = None
    PointerProperty = None

if bpy is not None:
    from . import capture, properties, ui

    CLASSES = (*properties.CLASSES, *capture.CLASSES, *ui.CLASSES)
else:
    CLASSES = ()


def register() -> None:
    """Register types and attach settings to every Scene."""

    if bpy is None:
        raise RuntimeError("Sprite Sheet Helper registration requires Blender")
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.ssh_settings = PointerProperty(type=properties.SSH_Settings)


def unregister() -> None:
    """Remove settings and registered types in reverse dependency order."""

    if bpy is None:
        return
    if hasattr(bpy.types.Scene, "ssh_settings"):
        del bpy.types.Scene.ssh_settings
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
