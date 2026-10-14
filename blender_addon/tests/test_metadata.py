from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest


MODULES = Path(__file__).resolve().parents[1] / "sprite_sheet_helper"
sys.path.insert(0, str(MODULES))

from atlas import AnimationRow, AtlasError, AtlasOptions, PixelImage, build_atlas  # noqa: E402
from metadata import (  # noqa: E402
    create_manifest,
    create_spritesheet_metadata,
    output_file_names,
    safe_file_stem,
    write_json_atomic,
)


def frame() -> PixelImage:
    return PixelImage(2, 3, bytes((255, 255, 255, 255)) * 6)


def workflow(direction: str) -> dict[str, str]:
    return {
        "workflowId": "topdown-4dir",
        "workflowLabel": "Top Down 4-directional",
        "modelUuid": "model-a",
        "animationName": "walk",
        "directionLabel": direction,
    }


class MetadataTests(unittest.TestCase):
    def setUp(self) -> None:
        self.rows = (
            AnimationRow("walk_N", (frame(), frame()), 8, workflow("N")),
            AnimationRow("walk_E", (frame(),), 8, workflow("E")),
        )
        self.build = build_atlas(self.rows, AtlasOptions(padding=1))
        self.when = datetime(2026, 10, 14, 12, 30, tzinfo=timezone.utc)

    def test_generic_json_matches_app_semantics(self) -> None:
        document = create_spritesheet_metadata(self.rows, self.build.plan, exported_at=self.when)
        self.assertEqual(
            document["meta"],
            {
                "version": "1.0",
                "exportedAt": "2026-10-14T12:30:00.000Z",
                "imageWidth": 8,
                "imageHeight": 10,
                "frameCount": 3,
                "animationCount": 2,
                "spacing": 2,
                "margin": 0,
            },
        )
        self.assertEqual(document["animations"][0]["quads"], [
            {"x": 1, "y": 1, "w": 2, "h": 3},
            {"x": 5, "y": 1, "w": 2, "h": 3},
        ])
        self.assertEqual(document["directionalAnimations"], [{
            "name": "walk",
            "workflowId": "topdown-4dir",
            "workflowLabel": "Top Down 4-directional",
            "modelUuid": "model-a",
            "directions": [
                {"label": "N", "animation": "walk_N"},
                {"label": "E", "animation": "walk_E"},
            ],
        }])

    def test_manifest_contains_rect_slot_source_and_workflow(self) -> None:
        manifest = create_manifest(self.rows, self.build.plan, exported_at=self.when)
        self.assertEqual(manifest["generatedBy"], "sprite-sheet-helper-blender")
        self.assertEqual(manifest["atlas"]["pageCount"], 1)
        self.assertEqual(manifest["animations"][0]["frames"][0], {
            "index": 0,
            "page": 0,
            "image": "spritesheet.png",
            "rect": {"x": 1, "y": 1, "w": 2, "h": 3},
            "slot": {"x": 0, "y": 0, "w": 4, "h": 5},
            "source": {"width": 2, "height": 3},
        })
        self.assertEqual(manifest["animations"][1]["workflow"], workflow("E"))

    def test_multi_page_metadata_names_every_page(self) -> None:
        row = AnimationRow("walk", (frame(),) * 3)
        build = build_atlas((row,), AtlasOptions(max_atlas_size=4, allow_multi_page=True))
        document = create_spritesheet_metadata(
            (row,), build.plan, "hero.png", "hero_normal.png", self.when
        )
        self.assertEqual([page["image"] for page in document["meta"]["pages"]], [
            "hero.png", "hero_2.png"
        ])
        self.assertEqual([quad["page"] for quad in document["animations"][0]["quads"]], [0, 0, 1])

    def test_json_write_is_stable_and_has_no_temporary_file(self) -> None:
        document = create_spritesheet_metadata(self.rows, self.build.plan, exported_at=self.when)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "hero.json"
            write_json_atomic(path, document)
            first = path.read_bytes()
            write_json_atomic(path, document)
            self.assertEqual(path.read_bytes(), first)
            self.assertEqual(json.loads(first), document)
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_names_are_portable_and_deterministic(self) -> None:
        self.assertEqual(safe_file_stem(" Hero / Walk! "), "hero-walk")
        self.assertEqual(output_file_names("Hero"), {
            "image": "hero.png",
            "metadata": "hero.json",
            "manifest": "hero.manifest.json",
        })

    def test_invalid_workflow_fails_with_actionable_message(self) -> None:
        row = AnimationRow("walk_N", (frame(),), workflow={"id": "topdown"})
        build = build_atlas((row,))
        with self.assertRaisesRegex(AtlasError, "workflowId"):
            create_spritesheet_metadata((row,), build.plan, exported_at=self.when)


if __name__ == "__main__":
    unittest.main()
