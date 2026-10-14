"""Blender-neutral PNG and deterministic row-atlas helpers.

This module intentionally has no dependency on :mod:`bpy` (or Pillow), so its
layout and image code can be tested with an ordinary Python interpreter.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import binascii
import math
import os
import struct
import tempfile
import zlib
from typing import Any, Mapping, Sequence, Union


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class AtlasError(ValueError):
    """Raised when an atlas or source PNG is invalid."""


@dataclass(frozen=True)
class PixelImage:
    """An 8-bit, row-major RGBA image."""

    width: int
    height: int
    pixels: bytes

    def __post_init__(self) -> None:
        if self.width < 1 or self.height < 1:
            raise AtlasError("Image dimensions must be positive")
        if len(self.pixels) != self.width * self.height * 4:
            raise AtlasError(
                "RGBA buffer length does not match image dimensions "
                f"({len(self.pixels)} != {self.width * self.height * 4})"
            )

    @classmethod
    def transparent(cls, width: int, height: int) -> "PixelImage":
        return cls(width, height, bytes(width * height * 4))

    def pixel(self, x: int, y: int) -> bytes:
        if not (0 <= x < self.width and 0 <= y < self.height):
            raise IndexError((x, y))
        offset = (y * self.width + x) * 4
        return self.pixels[offset : offset + 4]


FrameInput = Union[PixelImage, str, os.PathLike[str]]


@dataclass(frozen=True)
class AnimationRow:
    """One animation row, in the order it should appear in the atlas."""

    name: str
    frames: Sequence[FrameInput]
    fps: float = 12
    workflow: Mapping[str, Any] | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.name, str) or not self.name.strip():
            raise AtlasError("Animation names must be non-empty strings")
        if not self.frames:
            raise AtlasError(f"Animation {self.name!r} has no frames")
        if isinstance(self.fps, bool) or not isinstance(self.fps, (int, float)):
            raise AtlasError(f"Animation {self.name!r} has an invalid fps")


@dataclass(frozen=True)
class AtlasOptions:
    padding: int = 0
    extrude: int = 0
    scale: float = 1.0
    max_atlas_size: int = 2048
    allow_multi_page: bool = False
    sprite_margin: int = 0
    layout: str = "rows"

    def __post_init__(self) -> None:
        if self.layout != "rows":
            raise AtlasError("The Blender add-on currently supports row atlases only")
        for name in ("padding", "extrude", "sprite_margin"):
            value = getattr(self, name)
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise AtlasError(f"{name} must be a non-negative integer")
        if isinstance(self.scale, bool) or not isinstance(self.scale, (int, float)) or not math.isfinite(self.scale) or self.scale <= 0:
            raise AtlasError("scale must be greater than zero")
        if isinstance(self.max_atlas_size, bool) or not isinstance(self.max_atlas_size, int) or self.max_atlas_size < 1:
            raise AtlasError("max_atlas_size must be positive")


@dataclass(frozen=True)
class AtlasPage:
    index: int
    width: int
    height: int


@dataclass(frozen=True)
class AtlasPlacement:
    row_index: int
    frame_index: int
    page: int
    x: int
    y: int
    w: int
    h: int
    slot_x: int
    slot_y: int
    slot_w: int
    slot_h: int


@dataclass(frozen=True)
class AtlasPlan:
    options: AtlasOptions
    pages: tuple[AtlasPage, ...]
    placements: tuple[AtlasPlacement, ...]


@dataclass(frozen=True)
class AtlasBuild:
    rows: tuple[AnimationRow, ...]
    images: tuple[tuple[PixelImage, ...], ...]
    plan: AtlasPlan
    pages: tuple[PixelImage, ...]
    files: tuple[Path, ...] = field(default_factory=tuple)


def _chunk(kind: bytes, payload: bytes) -> bytes:
    checksum = binascii.crc32(kind)
    checksum = binascii.crc32(payload, checksum) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)


def encode_png(image: PixelImage) -> bytes:
    """Encode *image* as a deterministic non-interlaced RGBA PNG."""

    stride = image.width * 4
    scanlines = b"".join(
        b"\x00" + image.pixels[y * stride : (y + 1) * stride]
        for y in range(image.height)
    )
    header = struct.pack(">IIBBBBB", image.width, image.height, 8, 6, 0, 0, 0)
    return (
        PNG_SIGNATURE
        + _chunk(b"IHDR", header)
        + _chunk(b"IDAT", zlib.compress(scanlines, level=9))
        + _chunk(b"IEND", b"")
    )


def _paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def decode_png(data: bytes) -> PixelImage:
    """Decode common 8-bit Blender PNG output into RGBA pixels.

    Grayscale, RGB, indexed, grayscale-alpha, and RGBA PNGs are supported.
    Interlaced and 16-bit inputs fail explicitly instead of being misread.
    """

    if not data.startswith(PNG_SIGNATURE):
        raise AtlasError("Not a PNG file")
    offset = len(PNG_SIGNATURE)
    width = height = bit_depth = color_type = interlace = None
    compressed = bytearray()
    palette = transparency = None
    saw_end = False
    while offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        end = offset + 12 + length
        if end > len(data):
            raise AtlasError("Truncated PNG chunk")
        payload = data[offset + 8 : offset + 8 + length]
        expected_crc = struct.unpack(">I", data[offset + 8 + length : end])[0]
        if binascii.crc32(kind + payload) & 0xFFFFFFFF != expected_crc:
            raise AtlasError(f"Invalid PNG checksum in {kind.decode('ascii', 'replace')}")
        if kind == b"IHDR":
            if length != 13:
                raise AtlasError("Invalid PNG header")
            width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
                ">IIBBBBB", payload
            )
            if compression != 0 or filtering != 0:
                raise AtlasError("Unsupported PNG compression or filter method")
        elif kind == b"PLTE":
            palette = payload
        elif kind == b"tRNS":
            transparency = payload
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            saw_end = True
            break
        offset = end
    if None in (width, height, bit_depth, color_type, interlace) or not saw_end:
        raise AtlasError("PNG is missing required chunks")
    if width < 1 or height < 1:
        raise AtlasError("PNG dimensions must be positive")
    if bit_depth != 8:
        raise AtlasError("Only 8-bit PNG files are supported")
    if interlace != 0:
        raise AtlasError("Interlaced PNG files are not supported")
    channels_by_type = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}
    channels = channels_by_type.get(color_type)
    if channels is None:
        raise AtlasError(f"Unsupported PNG color type {color_type}")
    try:
        raw = zlib.decompress(bytes(compressed))
    except zlib.error as exc:
        raise AtlasError("Invalid PNG image data") from exc
    stride = width * channels
    expected = height * (stride + 1)
    if len(raw) != expected:
        raise AtlasError(f"PNG data has length {len(raw)}; expected {expected}")
    rows: list[bytes] = []
    cursor = 0
    previous = bytes(stride)
    for _ in range(height):
        filter_type = raw[cursor]
        source = raw[cursor + 1 : cursor + 1 + stride]
        cursor += stride + 1
        result = bytearray(stride)
        for index, value in enumerate(source):
            left = result[index - channels] if index >= channels else 0
            up = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = up
            elif filter_type == 3:
                predictor = (left + up) // 2
            elif filter_type == 4:
                predictor = _paeth(left, up, upper_left)
            else:
                raise AtlasError(f"Unsupported PNG row filter {filter_type}")
            result[index] = (value + predictor) & 0xFF
        previous = bytes(result)
        rows.append(previous)
    rgba = bytearray(width * height * 4)
    out = 0
    for row in rows:
        for x in range(width):
            i = x * channels
            if color_type == 6:
                pixel = row[i : i + 4]
            elif color_type == 2:
                r, g, b = row[i : i + 3]
                alpha = 0 if transparency == bytes((0, r, 0, g, 0, b)) else 255
                pixel = bytes((r, g, b, alpha))
            elif color_type == 0:
                gray = row[i]
                alpha = 0 if transparency == bytes((0, gray)) else 255
                pixel = bytes((gray, gray, gray, alpha))
            elif color_type == 4:
                gray, alpha = row[i : i + 2]
                pixel = bytes((gray, gray, gray, alpha))
            else:
                palette_index = row[i]
                palette_offset = palette_index * 3
                if palette is None or palette_offset + 3 > len(palette):
                    raise AtlasError("Indexed PNG references a missing palette entry")
                alpha = transparency[palette_index] if transparency and palette_index < len(transparency) else 255
                pixel = palette[palette_offset : palette_offset + 3] + bytes((alpha,))
            rgba[out : out + 4] = pixel
            out += 4
    return PixelImage(width, height, bytes(rgba))


def load_png(path: str | os.PathLike[str]) -> PixelImage:
    try:
        return decode_png(Path(path).read_bytes())
    except OSError as exc:
        raise AtlasError(f"Could not read PNG {path!s}: {exc}") from exc


def _atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, path)
    except BaseException:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass
        raise


def save_png(path: str | os.PathLike[str], image: PixelImage) -> Path:
    destination = Path(path)
    _atomic_write(destination, encode_png(image))
    return destination


def atlas_page_file_name(base_name: str, page_index: int) -> str:
    if page_index < 0:
        raise AtlasError("page_index must be non-negative")
    if page_index == 0:
        return base_name
    path = Path(base_name)
    numbered = f"{path.stem}_{page_index + 1}{path.suffix}"
    return str(path.with_name(numbered))


def _load_rows(rows: Sequence[AnimationRow]) -> tuple[tuple[PixelImage, ...], ...]:
    if not rows:
        raise AtlasError("No animation rows to export")
    names: set[str] = set()
    loaded: list[tuple[PixelImage, ...]] = []
    for row in rows:
        if row.name in names:
            raise AtlasError(f"Duplicate animation name {row.name!r}")
        names.add(row.name)
        images = tuple(frame if isinstance(frame, PixelImage) else load_png(frame) for frame in row.frames)
        dimensions = {(image.width, image.height) for image in images}
        if len(dimensions) != 1:
            raise AtlasError(f"Animation {row.name!r} contains frames with different dimensions")
        loaded.append(images)
    return tuple(loaded)


def _scaled(value: int, scale: float) -> int:
    return max(1, int(value * scale + 0.5))


def create_rows_plan(
    rows: Sequence[AnimationRow],
    images: Sequence[Sequence[PixelImage]] | None = None,
    options: AtlasOptions | None = None,
) -> AtlasPlan:
    """Create a stable row-major atlas plan.

    With multi-page output, long rows wrap into shelves and pages at
    ``max_atlas_size``. Without it, rows remain intact and the page is allowed
    to exceed that soft limit, matching the desktop app's row-layout contract.
    """

    opts = options or AtlasOptions()
    loaded = tuple(tuple(group) for group in images) if images is not None else _load_rows(rows)
    if len(rows) != len(loaded):
        raise AtlasError("Row and image counts do not match")
    pages: list[dict[str, int]] = [{"width": 0, "height": 0}]
    placements: list[AtlasPlacement] = []
    page_index = 0
    x = y = shelf_height = 0
    gutter = opts.padding + opts.extrude
    for row_index, (row, row_images) in enumerate(zip(rows, loaded)):
        if len(row.frames) != len(row_images):
            raise AtlasError(f"Frame count mismatch for {row.name!r}")
        if not opts.allow_multi_page:
            x, shelf_height = 0, 0
            y = pages[0]["height"]
        elif x:
            x, y, shelf_height = 0, y + shelf_height, 0
        for frame_index, image in enumerate(row_images):
            w = _scaled(image.width, opts.scale) + opts.sprite_margin * 2
            h = _scaled(image.height, opts.scale) + opts.sprite_margin * 2
            slot_w, slot_h = w + gutter * 2, h + gutter * 2
            if opts.allow_multi_page and (slot_w > opts.max_atlas_size or slot_h > opts.max_atlas_size):
                raise AtlasError(
                    f"Frame {row.name!r}:{frame_index} ({slot_w}x{slot_h}) exceeds max atlas size {opts.max_atlas_size}"
                )
            if opts.allow_multi_page and x and x + slot_w > opts.max_atlas_size:
                x, y, shelf_height = 0, y + shelf_height, 0
            if opts.allow_multi_page and placements and y + slot_h > opts.max_atlas_size:
                page_index += 1
                pages.append({"width": 0, "height": 0})
                x = y = shelf_height = 0
            placement = AtlasPlacement(
                row_index, frame_index, page_index,
                x + gutter, y + gutter, w, h,
                x, y, slot_w, slot_h,
            )
            placements.append(placement)
            page = pages[page_index]
            page["width"] = max(page["width"], x + slot_w)
            page["height"] = max(page["height"], y + slot_h)
            x += slot_w
            shelf_height = max(shelf_height, slot_h)
        if not opts.allow_multi_page:
            pages[0]["height"] = y + shelf_height
        else:
            pages[page_index]["height"] = max(pages[page_index]["height"], y + shelf_height)
    page_objects = tuple(AtlasPage(index, page["width"], page["height"]) for index, page in enumerate(pages))
    return AtlasPlan(opts, page_objects, tuple(placements))


def _resize_nearest(image: PixelImage, width: int, height: int) -> PixelImage:
    if image.width == width and image.height == height:
        return image
    result = bytearray(width * height * 4)
    for y in range(height):
        source_y = min(image.height - 1, y * image.height // height)
        for x in range(width):
            source_x = min(image.width - 1, x * image.width // width)
            source = (source_y * image.width + source_x) * 4
            target = (y * width + x) * 4
            result[target : target + 4] = image.pixels[source : source + 4]
    return PixelImage(width, height, bytes(result))


def _set_pixel(buffer: bytearray, width: int, x: int, y: int, rgba: bytes) -> None:
    offset = (y * width + x) * 4
    buffer[offset : offset + 4] = rgba


def render_atlas_pages(
    images: Sequence[Sequence[PixelImage]], plan: AtlasPlan
) -> tuple[PixelImage, ...]:
    """Render a plan using nearest-neighbour scaling and edge extrusion."""

    buffers = [bytearray(page.width * page.height * 4) for page in plan.pages]
    margin = plan.options.sprite_margin
    extrude = plan.options.extrude
    for placement in plan.placements:
        try:
            source = images[placement.row_index][placement.frame_index]
        except IndexError as exc:
            raise AtlasError("Atlas placement references a missing frame") from exc
        draw_w, draw_h = placement.w - margin * 2, placement.h - margin * 2
        resized = _resize_nearest(source, draw_w, draw_h)
        buffer = buffers[placement.page]
        page_width = plan.pages[placement.page].width
        draw_x, draw_y = placement.x + margin, placement.y + margin
        for y in range(draw_h):
            source_start = y * draw_w * 4
            target_start = ((draw_y + y) * page_width + draw_x) * 4
            buffer[target_start : target_start + draw_w * 4] = resized.pixels[source_start : source_start + draw_w * 4]
        if extrude:
            left, right = resized.pixel(0, 0), resized.pixel(draw_w - 1, 0)
            for amount in range(1, extrude + 1):
                # Match Canvas drawImage extrusion: source edges are stretched
                # over the complete frame rect, including sprite margin.
                for x in range(placement.w):
                    source_x = min(draw_w - 1, x * draw_w // placement.w)
                    _set_pixel(buffer, page_width, placement.x + x, placement.y - amount, resized.pixel(source_x, 0))
                    _set_pixel(buffer, page_width, placement.x + x, placement.y + placement.h - 1 + amount, resized.pixel(source_x, draw_h - 1))
                for y in range(placement.h):
                    source_y = min(draw_h - 1, y * draw_h // placement.h)
                    _set_pixel(buffer, page_width, placement.x - amount, placement.y + y, resized.pixel(0, source_y))
                    _set_pixel(buffer, page_width, placement.x + placement.w - 1 + amount, placement.y + y, resized.pixel(draw_w - 1, source_y))
                for xx, yy, pixel in (
                    (placement.x - amount, placement.y - amount, left),
                    (placement.x + placement.w - 1 + amount, placement.y - amount, right),
                    (placement.x - amount, placement.y + placement.h - 1 + amount, resized.pixel(0, draw_h - 1)),
                    (placement.x + placement.w - 1 + amount, placement.y + placement.h - 1 + amount, resized.pixel(draw_w - 1, draw_h - 1)),
                ):
                    _set_pixel(buffer, page_width, xx, yy, pixel)
    return tuple(PixelImage(page.width, page.height, bytes(buffer)) for page, buffer in zip(plan.pages, buffers))


def build_atlas(rows: Sequence[AnimationRow], options: AtlasOptions | None = None) -> AtlasBuild:
    stable_rows = tuple(rows)
    images = _load_rows(stable_rows)
    plan = create_rows_plan(stable_rows, images, options)
    pages = render_atlas_pages(images, plan)
    return AtlasBuild(stable_rows, images, plan, pages)


def write_atlas_pages(
    build: AtlasBuild, output_directory: str | os.PathLike[str], image_name: str = "spritesheet.png"
) -> AtlasBuild:
    if Path(image_name).name != image_name or not image_name.lower().endswith(".png"):
        raise AtlasError("image_name must be a plain .png file name")
    output = Path(output_directory)
    files = tuple(
        save_png(output / atlas_page_file_name(image_name, index), page)
        for index, page in enumerate(build.pages)
    )
    return AtlasBuild(build.rows, build.images, build.plan, build.pages, files)


__all__ = [
    "AnimationRow", "AtlasBuild", "AtlasError", "AtlasOptions", "AtlasPage",
    "AtlasPlacement", "AtlasPlan", "PixelImage", "atlas_page_file_name",
    "build_atlas", "create_rows_plan", "decode_png", "encode_png", "load_png",
    "render_atlas_pages", "save_png", "write_atlas_pages",
]
