---
title: Materials Workbench
---

The **Materials Workbench** is a large studio-style workspace for editing reusable materials and assigning them to imported model slots.

Open it from the **Materials** menu. If a model is selected, choose **Open for Selected Model** to focus that model immediately.

## What It Manages

- **Material assets** — Reusable material definitions stored in the project.
- **Model slots** — Mesh/material slots detected from the selected model at runtime.
- **Assignments** — Links between a material asset and a model slot.
- **Texture assets** — Uploaded or generated texture files used by materials.
- **Retro variants** — Non-destructive generated texture variants for stylized output.

## Typical Workflow

1. Select a model or open the workbench from the Materials menu.
2. Choose a model in the **Slots** column.
3. Create or select a reusable material.
4. Assign it to a single slot, the current mesh, or the whole model.
5. Adjust material settings and texture maps.
6. Generate texture variants when you want non-destructive pixelated or retro looks.

Assignments are applied at runtime, so the imported model file is not rewritten.

## Slots and Assignments

The Slots column lists the material slots found on the selected model. Use search to filter by mesh name, mesh path, original material name, or assigned material name.

You can:

- Apply the selected material to one slot.
- Apply it to every slot on the same mesh.
- Apply it to the whole model.
- Reset a slot back to the imported material.

## Texture Assets

Texture files are stored outside the JSON body of the project state and bundled when you save a `.sshProj` project. This keeps project JSON readable while preserving uploaded and generated image data.

Generated variants keep their source relationship, so you can create stylized versions without destroying the original texture asset.

## Persistence and Storage

Saved `.sshProj` files include material definitions, assignments, and texture files. Browser recovery also restores material state while local site storage is intact.

Because texture files use browser private storage while you work, clearing site data can remove unsaved texture assets. Save a `.sshProj` backup after major material edits.

## Tips

- Name reusable materials by role, such as `hero-cloth-blue` or `enemy-metal-dark`.
- Use slot search when imported models contain many mesh parts.
- Prefer generated variants over editing original texture files directly.
- Save before running large workflow exports so material assignments and texture variants are checkpointed.
