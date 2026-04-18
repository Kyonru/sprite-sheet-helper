#!/usr/bin/env node
// Merges all animation FBX files in a folder onto BASE_MODEL.fbx using Blender.
// Outputs COMBINED.glb with clean animation names matching the Xbot.glb format.
// Usage: node scripts/merge-animations.js [folder]
// Default folder: ./example

import { spawnSync, execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve, join } from "path";
import { tmpdir } from "os";

const folder = resolve(process.argv[2] ?? "./example");

if (!existsSync(folder)) {
  console.error(`Folder not found: ${folder}`);
  process.exit(1);
}

function findBlender() {
  // 1. PATH
  try {
    const which = execSync("which blender", { encoding: "utf8" }).trim();
    if (which) return which;
  } catch {}

  // 2. macOS app bundle
  const macPaths = [
    "/Applications/Blender.app/Contents/MacOS/Blender",
    "/Applications/Blender/Blender.app/Contents/MacOS/Blender",
  ];
  for (const p of macPaths) {
    if (existsSync(p)) return p;
  }

  // 3. Glob macOS versioned bundles e.g. /Applications/Blender 4.2.app
  try {
    const glob = execSync(
      "ls /Applications/ | grep -i blender | head -1",
      { encoding: "utf8" }
    ).trim();
    if (glob) {
      const candidate = `/Applications/${glob}/Contents/MacOS/Blender`;
      if (existsSync(candidate)) return candidate;
    }
  } catch {}

  // 4. Windows common paths
  const winPaths = [
    "C:\\Program Files\\Blender Foundation\\Blender\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
  ];
  for (const p of winPaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

const blender = findBlender();
if (!blender) {
  console.error(
    "Blender not found. Install Blender and make sure it is accessible.\n" +
    "On macOS: place Blender.app in /Applications/\n" +
    "On Windows: install to default Program Files path\n" +
    "Or add `blender` to your PATH."
  );
  process.exit(1);
}

console.log(`Using Blender: ${blender}`);
console.log(`Folder: ${folder}`);

const pythonScript = `
import bpy
import os
import sys

argv = sys.argv
sep = argv.index("--") if "--" in argv else len(argv)
folder = argv[sep + 1]

base_path = os.path.join(folder, "BASE_MODEL.fbx")
output_path = os.path.join(folder, "COMBINED.glb")

if not os.path.exists(base_path):
    print(f"[merge] ERROR: BASE_MODEL.fbx not found in {folder}")
    sys.exit(1)

# Clear scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import base model — track which objects and actions belong to it
print(f"[merge] Importing base model: {base_path}")
before_import = set(bpy.data.actions.keys())
bpy.ops.import_scene.fbx(filepath=base_path)

# Remove any action that came with BASE_MODEL (T-pose / bind pose stub)
for name in set(bpy.data.actions.keys()) - before_import:
    bpy.data.actions.remove(bpy.data.actions[name])

# Find base armature
base_armature = next(
    (obj for obj in bpy.data.objects if obj.type == "ARMATURE"),
    None
)
if base_armature is None:
    print("[merge] ERROR: No armature found in BASE_MODEL.fbx")
    sys.exit(1)

print(f"[merge] Base armature: {base_armature.name}")
print(f"[merge] Base mesh objects: {[o.name for o in bpy.data.objects if o.type == 'MESH']}")

# Ensure base armature has animation data
if base_armature.animation_data is None:
    base_armature.animation_data_create()

# Track base model objects so we never delete them
base_object_names = set(bpy.data.objects.keys())

# Collect all animation FBX files (exclude BASE_MODEL and COMBINED)
anim_files = sorted([
    f for f in os.listdir(folder)
    if f.lower().endswith(".fbx")
    and f != "BASE_MODEL.fbx"
    and f.lower() != "combined.fbx"
    and f.lower() != "combined.glb"
])

if not anim_files:
    print("[merge] No animation FBX files found — exporting base model as-is.")
else:
    for anim_file in anim_files:
        anim_path = os.path.join(folder, anim_file)
        anim_name = os.path.splitext(anim_file)[0]
        print(f"[merge] Importing animation: {anim_name}")

        before_obj = set(bpy.data.objects.keys())
        before_act = set(bpy.data.actions.keys())
        bpy.ops.import_scene.fbx(filepath=anim_path)
        new_objects = [bpy.data.objects[k] for k in set(bpy.data.objects.keys()) - before_obj]
        new_actions = [bpy.data.actions[k] for k in set(bpy.data.actions.keys()) - before_act]

        # Find the armature that was just imported
        imported_armature = next(
            (obj for obj in new_objects if obj.type == "ARMATURE"),
            None
        )

        action = None
        if imported_armature and imported_armature.animation_data:
            action = imported_armature.animation_data.action
        elif new_actions:
            action = new_actions[0]

        if action is None:
            print(f"[merge]   No action found in {anim_file}, skipping")
        else:
            # Rename action to the filename (clean, no Armature| prefix)
            action.name = anim_name
            # Fake-user so the action survives object deletion
            action.use_fake_user = True

            # Add as NLA strip on the base armature
            track = base_armature.animation_data.nla_tracks.new()
            track.name = anim_name
            track.strips.new(anim_name, int(action.frame_range[0]), action)
            print(f"[merge]   Added animation: {anim_name}  ({int(action.frame_range[1])} frames)")

        # Remove all objects imported from this animation file
        for obj in new_objects:
            bpy.data.objects.remove(obj, do_unlink=True)

        # Remove any leftover actions we didn't keep
        for act in new_actions:
            if act != action and act.name in bpy.data.actions:
                bpy.data.actions.remove(act)

# Deselect everything, then select only base model objects for export
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    obj.select_set(True)

print(f"[merge] Scene objects: {[o.name for o in bpy.data.objects]}")
print(f"[merge] Actions to export ({len(bpy.data.actions)}):")
for act in bpy.data.actions:
    print(f"  '{act.name}'  frames={act.frame_range[:]}")

# Export as GLB — clean animation names, self-contained single file
print(f"[merge] Exporting to: {output_path}")
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    export_animations=True,
    export_nla_strips=True,
    export_nla_strips_merged_animation_name='',
    export_anim_single_armature=True,
    export_reset_pose_bones=True,
    use_selection=False,
)
print("[merge] Done.")
`;

const tmpScript = join(tmpdir(), `merge_animations_${Date.now()}.py`);
writeFileSync(tmpScript, pythonScript, "utf8");

try {
  const result = spawnSync(
    blender,
    ["--background", "--python", tmpScript, "--", folder],
    { stdio: "inherit", encoding: "utf8" }
  );

  if (result.status !== 0) {
    console.error(`\nBlender exited with code ${result.status}`);
    process.exit(result.status ?? 1);
  }
} finally {
  unlinkSync(tmpScript);
}
