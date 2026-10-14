"""3D View sidebar UI for Sprite Sheet Helper.

The panels intentionally contain no rendering logic. Keeping draw code thin makes
the operators usable from both Blender's UI and Python/headless workflows.
"""

from __future__ import annotations

import bpy
from bpy.types import Panel, UIList


def _settings(context):
    """Return registered settings, or ``None`` while an add-on reload is underway."""

    return getattr(context.scene, "ssh_settings", None) if context.scene else None


def _enabled_actions(settings) -> int:
    return sum(1 for item in settings.actions if item.enabled and item.action)


def _resolved_ui_target(context, settings):
    """Mirror the core's convenient target fallback for accurate UI state."""

    if settings.target_type == "COLLECTION":
        return settings.target_collection or getattr(context, "collection", None)
    if settings.target_armature:
        return settings.target_armature
    active = getattr(context, "active_object", None)
    if active and active.type == "ARMATURE":
        return active
    return next(
        (obj for obj in getattr(context, "selected_objects", ()) if obj.type == "ARMATURE"),
        None,
    )


def _validation_messages(context, settings) -> list[tuple[str, str]]:
    """Return user-actionable validation messages as (icon, message) pairs."""

    messages: list[tuple[str, str]] = []
    target = _resolved_ui_target(context, settings)
    if target is None:
        kind = "armature" if settings.target_type == "ARMATURE" else "collection"
        messages.append(("ERROR", f"Choose a target {kind}."))
    if not settings.output_directory.strip():
        messages.append(("ERROR", "Choose an output folder."))
    if not settings.file_prefix.strip():
        messages.append(("ERROR", "Enter a file prefix."))
    if _enabled_actions(settings) == 0:
        messages.append(("ERROR", "Enable at least one action."))
    return messages


class SSH_UL_actions(UIList):
    """Compact action picker with an enable toggle and useful range summary."""

    bl_idname = "SSH_UL_actions"

    def draw_item(
        self,
        _context,
        layout,
        _data,
        item,
        _icon,
        _active_data,
        _active_property,
        _index=0,
        _flt_flag=0,
    ):
        if self.layout_type in {"DEFAULT", "COMPACT"}:
            row = layout.row(align=True)
            row.prop(item, "enabled", text="")
            row.prop(item, "action", text="")
            if item.use_custom_range:
                row.label(text=f"{item.frame_start:g}–{item.frame_end:g}")
        elif self.layout_type == "GRID":
            layout.alignment = "CENTER"
            layout.label(text="", icon="ACTION")


class SSH_PT_base:
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Sprite Sheet"

    @classmethod
    def poll(cls, context):
        return _settings(context) is not None


class SSH_PT_main(SSH_PT_base, Panel):
    bl_idname = "SSH_PT_main"
    bl_label = "Sprite Sheet Helper"

    def draw(self, context):
        settings = _settings(context)
        layout = self.layout

        target = _resolved_ui_target(context, settings)
        summary = layout.column(align=True)
        summary.label(
            text=target.name if target else "No target selected",
            icon="ARMATURE_DATA" if settings.target_type == "ARMATURE" else "OUTLINER_COLLECTION",
        )
        summary.label(
            text=f"{_enabled_actions(settings)} enabled action(s) · "
            f"{settings.resolution_x} × {settings.resolution_y} px",
            icon="RENDER_ANIMATION",
        )


class SSH_PT_workflow(SSH_PT_base, Panel):
    bl_parent_id = "SSH_PT_main"
    bl_idname = "SSH_PT_workflow"
    bl_label = "Workflow"
    bl_options = {"DEFAULT_CLOSED"}

    def draw(self, context):
        self.layout.prop(_settings(context), "workflow", text="Preset")


class SSH_PT_target_camera(SSH_PT_base, Panel):
    bl_parent_id = "SSH_PT_main"
    bl_idname = "SSH_PT_target_camera"
    bl_label = "Target & Camera"

    def draw(self, context):
        settings = _settings(context)
        layout = self.layout

        layout.prop(settings, "target_type", expand=True)
        if settings.target_type == "ARMATURE":
            layout.prop(settings, "target_armature", text="Armature")
        else:
            layout.prop(settings, "target_collection", text="Collection")

        layout.separator()
        layout.prop(settings, "projection", expand=True)
        row = layout.row(align=True)
        row.prop(settings, "resolution_x", text="Width")
        row.prop(settings, "resolution_y", text="Height")
        layout.prop(settings, "margin")
        layout.prop(settings, "transparent")
        layout.label(text="Camera framing is fitted automatically.", icon="INFO")


class SSH_PT_actions(SSH_PT_base, Panel):
    bl_parent_id = "SSH_PT_main"
    bl_idname = "SSH_PT_actions"
    bl_label = "Actions"

    def draw(self, context):
        settings = _settings(context)
        layout = self.layout

        toolbar = layout.row(align=True)
        toolbar.operator("ssh.refresh_actions", text="Find Actions", icon="FILE_REFRESH")
        toolbar.operator("ssh.add_action", text="", icon="ADD")
        toolbar.operator("ssh.remove_action", text="", icon="REMOVE")
        layout.template_list(
            "SSH_UL_actions",
            "",
            settings,
            "actions",
            settings,
            "action_index",
            rows=4,
        )

        if 0 <= settings.action_index < len(settings.actions):
            item = settings.actions[settings.action_index]
            detail = layout.box()
            detail.enabled = item.action is not None
            detail.prop(item, "use_custom_range", text="Custom Frame Range")
            if item.use_custom_range:
                row = detail.row(align=True)
                row.prop(item, "frame_start", text="Start")
                row.prop(item, "frame_end", text="End")


class SSH_PT_sampling(SSH_PT_base, Panel):
    bl_parent_id = "SSH_PT_main"
    bl_idname = "SSH_PT_sampling"
    bl_label = "Frame Sampling"
    bl_options = {"DEFAULT_CLOSED"}

    def draw(self, context):
        settings = _settings(context)
        layout = self.layout
        layout.prop(settings, "sampling_mode", expand=True)
        if settings.sampling_mode == "FPS":
            layout.prop(settings, "fps", text="Frames per Second")
        else:
            layout.prop(settings, "frame_count", text="Frames per Action")


class SSH_PT_output(SSH_PT_base, Panel):
    bl_parent_id = "SSH_PT_main"
    bl_idname = "SSH_PT_output"
    bl_label = "Output"

    def draw(self, context):
        settings = _settings(context)
        layout = self.layout
        layout.prop(settings, "output_directory", text="Folder")
        layout.prop(settings, "file_prefix", text="File Prefix")
        layout.label(text="Writes a PNG sprite sheet and JSON metadata.", icon="INFO")


class SSH_PT_capture(SSH_PT_base, Panel):
    bl_parent_id = "SSH_PT_main"
    bl_idname = "SSH_PT_capture"
    bl_label = "Capture"

    def draw(self, context):
        settings = _settings(context)
        layout = self.layout
        messages = _validation_messages(context, settings)
        for icon, message in messages:
            box = layout.box()
            box.label(text=message, icon=icon)

        button = layout.column()
        button.enabled = not messages
        button.scale_y = 1.4
        button.operator("ssh.render_sprites", text="Render Sprite Sheet", icon="RENDER_ANIMATION")
        if not messages:
            layout.label(text="Save your .blend before a long capture.", icon="INFO")


CLASSES = (
    SSH_UL_actions,
    SSH_PT_main,
    SSH_PT_workflow,
    SSH_PT_target_camera,
    SSH_PT_actions,
    SSH_PT_sampling,
    SSH_PT_output,
    SSH_PT_capture,
)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)


def unregister():
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)
