"""Persistent scene settings and target/action helpers for the add-on."""

import bpy
from bpy.props import BoolProperty, CollectionProperty, EnumProperty, FloatProperty, IntProperty, PointerProperty, StringProperty
from bpy.types import Action, Collection, Object, Operator, PropertyGroup

from .workflows import workflow_enum_items


def _armature_poll(_self, obj: Object | None) -> bool:
    return obj is not None and obj.type == "ARMATURE"


class SSH_ActionItem(PropertyGroup):
    """A selected Action plus optional per-action sampling range."""

    action: PointerProperty(name="Action", type=Action)
    enabled: BoolProperty(name="Render", default=True)
    use_custom_range: BoolProperty(name="Custom Range", default=False)
    frame_start: FloatProperty(name="Start", default=1.0)
    frame_end: FloatProperty(name="End", default=250.0)


class SSH_Settings(PropertyGroup):
    """Scene-owned, serializable capture configuration."""

    target_type: EnumProperty(name="Target", items=(("ARMATURE", "Armature", "Render an armature and its children"), ("COLLECTION", "Collection", "Render all objects in a collection")), default="ARMATURE")
    target_armature: PointerProperty(name="Armature", type=Object, poll=_armature_poll)
    target_collection: PointerProperty(name="Collection", type=Collection)
    workflow: EnumProperty(name="Workflow", items=workflow_enum_items(), default="topdown-8dir")
    projection: EnumProperty(name="Projection", items=(("ORTHO", "Orthographic", "Pixel-art friendly parallel projection"), ("PERSP", "Perspective", "Perspective camera projection")), default="ORTHO")
    resolution_x: IntProperty(name="Width", default=256, min=8, max=16384)
    resolution_y: IntProperty(name="Height", default=256, min=8, max=16384)
    transparent: BoolProperty(name="Transparent", default=True)
    sampling_mode: EnumProperty(name="Sampling", items=(("FPS", "Frames per second", "Sample using the requested output FPS"), ("FRAME_COUNT", "Frame count", "Sample an exact number of frames")), default="FPS")
    fps: FloatProperty(name="FPS", default=12.0, min=0.01, max=240.0)
    frame_count: IntProperty(name="Frames", default=8, min=1, max=10000)
    output_directory: StringProperty(name="Output", subtype="DIR_PATH", default="//sprite_sheet_output/")
    file_prefix: StringProperty(name="Prefix", default="sprite")
    margin: FloatProperty(name="Framing Margin", default=1.1, min=1.0, max=3.0)
    actions: CollectionProperty(type=SSH_ActionItem)
    action_index: IntProperty(default=0, min=0)


def get_settings(scene: bpy.types.Scene) -> SSH_Settings:
    """Return add-on settings from a scene."""

    return scene.ssh_settings


def resolve_armature(context: bpy.types.Context, settings: SSH_Settings) -> Object | None:
    """Resolve the configured armature, falling back to active/selected objects."""

    if settings.target_armature is not None:
        return settings.target_armature
    active = context.active_object
    if active is not None and active.type == "ARMATURE":
        return active
    return next((obj for obj in context.selected_objects if obj.type == "ARMATURE"), None)


def _descendants(root: Object) -> list[Object]:
    result: list[Object] = [root]
    stack = list(root.children)
    while stack:
        child = stack.pop()
        result.append(child)
        stack.extend(child.children)
    return result


def resolve_target(context: bpy.types.Context, settings: SSH_Settings) -> tuple[Object | None, list[Object]]:
    """Return ``(action_armature, render_objects)`` for current settings.

    Collection targets still select the first armature in the collection as the
    Action recipient. Nested collection objects are included by Blender's
    ``all_objects`` collection.
    """

    if settings.target_type == "COLLECTION":
        collection = settings.target_collection
        if collection is None:
            collection = getattr(getattr(context, "collection", None), "collection", None) or getattr(context, "collection", None)
        if collection is None:
            return None, []
        objects = list(collection.all_objects)
        armature = settings.target_armature or next((obj for obj in objects if obj.type == "ARMATURE"), None)
        return armature, objects
    armature = resolve_armature(context, settings)
    return armature, _descendants(armature) if armature else []


def enabled_action_items(settings: SSH_Settings) -> list[SSH_ActionItem]:
    """Return enabled entries which reference an Action."""

    return [item for item in settings.actions if item.enabled and item.action is not None]


class SSH_OT_refresh_actions(Operator):
    bl_idname = "ssh.refresh_actions"
    bl_label = "Refresh Actions"
    bl_description = "Populate the list with Actions compatible with the target armature"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        settings = get_settings(context.scene)
        existing = {item.action for item in settings.actions if item.action}
        actions = sorted(bpy.data.actions, key=lambda action: action.name.casefold())
        for action in actions:
            if action in existing:
                continue
            item = settings.actions.add()
            item.action = action
            item.frame_start, item.frame_end = action.frame_range
        return {"FINISHED"}


class SSH_OT_add_action(Operator):
    bl_idname = "ssh.add_action"
    bl_label = "Add Action"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        settings = get_settings(context.scene)
        settings.actions.add()
        settings.action_index = len(settings.actions) - 1
        return {"FINISHED"}


class SSH_OT_remove_action(Operator):
    bl_idname = "ssh.remove_action"
    bl_label = "Remove Action"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        return bool(getattr(context.scene, "ssh_settings", None) and context.scene.ssh_settings.actions)

    def execute(self, context):
        settings = get_settings(context.scene)
        index = min(settings.action_index, len(settings.actions) - 1)
        settings.actions.remove(index)
        settings.action_index = min(index, max(0, len(settings.actions) - 1))
        return {"FINISHED"}


CLASSES = (SSH_ActionItem, SSH_Settings, SSH_OT_refresh_actions, SSH_OT_add_action, SSH_OT_remove_action)
