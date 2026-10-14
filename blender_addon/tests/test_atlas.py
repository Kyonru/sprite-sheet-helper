from __future__ import annotations

from pathlib import Path
import sys
import tempfile
import unittest


MODULES = Path(__file__).resolve().parents[1] / "sprite_sheet_helper"
sys.path.insert(0, str(MODULES))

from atlas import (  # noqa: E402
    AnimationRow,
    AtlasError,
    AtlasOptions,
    PixelImage,
    atlas_page_file_name,
    build_atlas,
    decode_png,
    encode_png,
    load_png,
    write_atlas_pages,
)


def solid(width: int, height: int, color: tuple[int, int, int, int]) -> PixelImage:
    return PixelImage(width, height, bytes(color) * width * height)


class PngTests(unittest.TestCase):
    def test_rgba_round_trip_is_deterministic(self) -> None:
        image = PixelImage(2, 2, bytes(range(16)))
        encoded = encode_png(image)
        self.assertEqual(decode_png(encoded), image)
        self.assertEqual(encode_png(image), encoded)

    def test_rejects_corrupt_png(self) -> None:
        encoded = bytearray(encode_png(solid(1, 1, (1, 2, 3, 4))))
        encoded[-5] ^= 1
        with self.assertRaisesRegex(AtlasError, "checksum"):
            decode_png(bytes(encoded))

    def test_writes_atomically_loadable_png(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            image = solid(3, 2, (20, 30, 40, 255))
            build = build_atlas((AnimationRow("idle", (image,)),))
            written = write_atlas_pages(build, directory, "hero.png")
            self.assertEqual(written.files, (Path(directory) / "hero.png",))
            self.assertEqual(load_png(written.files[0]), image)
            self.assertEqual(list(Path(directory).iterdir()), [written.files[0]])


class AtlasLayoutTests(unittest.TestCase):
    def test_rows_preserve_animation_and_frame_order(self) -> None:
        rows = (
            AnimationRow("walk", (solid(2, 3, (255, 0, 0, 255)),) * 2, fps=8),
            AnimationRow("idle", (solid(1, 2, (0, 255, 0, 255)),), fps=4),
        )
        build = build_atlas(rows, AtlasOptions(padding=1, extrude=1, sprite_margin=2))
        self.assertEqual((build.pages[0].width, build.pages[0].height), (20, 21))
        self.assertEqual(
            [(p.row_index, p.frame_index, p.x, p.y, p.w, p.h) for p in build.plan.placements],
            [(0, 0, 2, 2, 6, 7), (0, 1, 12, 2, 6, 7), (1, 0, 2, 13, 5, 6)],
        )
        self.assertEqual(build.pages[0].pixel(4, 4), bytes((255, 0, 0, 255)))
        self.assertEqual(build.pages[0].pixel(4, 15), bytes((0, 255, 0, 255)))
        # One-pixel extrusion is outside the frame rect; outer padding remains clear.
        self.assertEqual(build.pages[0].pixel(2, 1), bytes((255, 0, 0, 255)))
        self.assertEqual(build.pages[0].pixel(1, 2), bytes((255, 0, 0, 255)))
        self.assertEqual(build.pages[0].pixel(2, 0), bytes((0, 0, 0, 0)))

    def test_multi_page_wraps_deterministically(self) -> None:
        frame = solid(3, 3, (1, 2, 3, 255))
        rows = (AnimationRow("walk", (frame,) * 5),)
        build = build_atlas(
            rows,
            AtlasOptions(max_atlas_size=6, allow_multi_page=True),
        )
        self.assertEqual([(page.width, page.height) for page in build.plan.pages], [(6, 6), (3, 3)])
        self.assertEqual([p.page for p in build.plan.placements], [0, 0, 0, 0, 1])

    def test_scaling_is_nearest_neighbour(self) -> None:
        source = PixelImage(2, 1, bytes((255, 0, 0, 255, 0, 0, 255, 255)))
        page = build_atlas((AnimationRow("test", (source,)),), AtlasOptions(scale=2)).pages[0]
        self.assertEqual((page.width, page.height), (4, 2))
        self.assertEqual([page.pixel(x, 0) for x in range(4)], [source.pixel(0, 0)] * 2 + [source.pixel(1, 0)] * 2)

    def test_validates_duplicate_names_and_mixed_frame_sizes(self) -> None:
        frame = solid(1, 1, (0, 0, 0, 0))
        with self.assertRaisesRegex(AtlasError, "Duplicate"):
            build_atlas((AnimationRow("idle", (frame,)), AnimationRow("idle", (frame,))))
        with self.assertRaisesRegex(AtlasError, "different dimensions"):
            build_atlas((AnimationRow("idle", (frame, solid(2, 1, (0, 0, 0, 0)))),))

    def test_page_names_match_desktop_contract(self) -> None:
        self.assertEqual(atlas_page_file_name("spritesheet.png", 0), "spritesheet.png")
        self.assertEqual(atlas_page_file_name("spritesheet.png", 1), "spritesheet_2.png")

    def test_rejects_non_finite_scale(self) -> None:
        with self.assertRaisesRegex(AtlasError, "scale"):
            AtlasOptions(scale=float("nan"))


if __name__ == "__main__":
    unittest.main()
