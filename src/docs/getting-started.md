---
title: Getting Started
---

# Getting Started

Sprite Sheet Helper lets you load 3D models, set up your scene, and export sprite sheets for use in game engines and frameworks.

## Quick Start

1. **Import a model** — Go to `File > Import Model` and select a `.glb`, `.gltf`, `.fbx`, or `.obj` file.
2. **Position the camera** — Use the Camera tab to choose a preset angle (isometric, top-down, side-scroller, etc.).
3. **Configure lighting** — Add lights from the Lighting tab to illuminate your model.
4. **Select an animation** — If your model has embedded animations, select one from the animations list in the export panel.
5. **Export** — Open the Export panel on the right, choose your format, and click Export.

## Supported Model Formats

| Format      | Extension | Notes                                      |
| ----------- | --------- | ------------------------------------------ |
| glTF Binary | .glb      | Recommended — compact, supports animations |
| glTF        | .gltf     | Text-based glTF with external assets       |
| FBX         | .fbx      | Widely supported by most 3D tools          |
| OBJ         | .obj      | Static models only, no animation support   |

## Interface Overview

The app is divided into several panels:

- **Top menu bar** — Tabs for File, Camera, Lighting, Effects, Settings, Workflows, History, and Help.
- **Left panel** — Scene explorer showing all objects in the scene hierarchy.
- **Center viewport** — Live 3D preview. Click and drag to orbit the camera.
- **Right panel** — Export configuration controls.

## Saving Your Work

Save your entire scene — including model placement, lights, camera settings, effects, and animation config — as a `.sshProj` project file via `File > Save Project`. Reopen it later with `File > Open Project`.
