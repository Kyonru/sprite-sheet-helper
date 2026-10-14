#!/usr/bin/env python3
"""Build installable Blender Extension and legacy add-on archives."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT / "sprite_sheet_helper"
DIST = ROOT / "dist"
MANIFEST = PACKAGE / "blender_manifest.toml"
ADDON_INIT = PACKAGE / "__init__.py"
EXTRA_FILES = ((ROOT / "README.md", "README.md"), (ROOT.parent / "LICENSE", "LICENSE"))
EXCLUDED_PARTS = {"__pycache__", ".pytest_cache"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo"}
ZIP_TIMESTAMP = (2020, 1, 1, 0, 0, 0)


def version() -> str:
    match = re.search(r'^version\s*=\s*"([^"]+)"', MANIFEST.read_text(), re.MULTILINE)
    if not match:
        raise RuntimeError(f"No version found in {MANIFEST}")
    manifest_version = match.group(1)
    info_match = re.search(r'"version"\s*:\s*\(([^)]+)\)', ADDON_INIT.read_text())
    if not info_match:
        raise RuntimeError(f"No bl_info version found in {ADDON_INIT}")
    legacy_version = ".".join(part.strip() for part in info_match.group(1).split(",") if part.strip())
    if legacy_version != manifest_version:
        raise RuntimeError(
            f"Version mismatch: manifest is {manifest_version}, bl_info is {legacy_version}"
        )
    return manifest_version


def source_files() -> list[Path]:
    return sorted(
        path
        for path in PACKAGE.rglob("*")
        if path.is_file()
        and not EXCLUDED_PARTS.intersection(path.parts)
        and path.suffix not in EXCLUDED_SUFFIXES
    )


def _write_reproducible(archive: ZipFile, source: Path, name: str) -> None:
    info = ZipInfo(name, date_time=ZIP_TIMESTAMP)
    info.compress_type = ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    archive.writestr(info, source.read_bytes())


def build_archive(destination: Path, legacy: bool) -> None:
    with ZipFile(destination, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for path in source_files():
            relative = path.relative_to(PACKAGE)
            archive_name = Path(PACKAGE.name) / relative if legacy else relative
            _write_reproducible(archive, path, archive_name.as_posix())
        for path, name in EXTRA_FILES:
            archive_name = Path(PACKAGE.name) / name if legacy else Path(name)
            _write_reproducible(archive, path, archive_name.as_posix())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--format",
        choices=("extension", "legacy", "both"),
        default="both",
        help="Archive layout to build (default: both)",
    )
    args = parser.parse_args()

    DIST.mkdir(exist_ok=True)
    name = f"sprite-sheet-helper-{version()}"
    outputs: list[Path] = []
    if args.format in {"extension", "both"}:
        output = DIST / f"{name}-extension.zip"
        build_archive(output, legacy=False)
        outputs.append(output)
    if args.format in {"legacy", "both"}:
        output = DIST / f"{name}-legacy.zip"
        build_archive(output, legacy=True)
        outputs.append(output)

    for output in outputs:
        print(output.relative_to(ROOT))


if __name__ == "__main__":
    main()
