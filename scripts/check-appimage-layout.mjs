#!/usr/bin/env node

import {
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APPSTREAM_ID = "com.kyonru.spritesheethelper";
const APPSTREAM_FILE = `${APPSTREAM_ID}.metainfo.xml`;

function requirePortableEntry(appDir, name) {
  const entry = join(appDir, name);
  let details;
  try {
    details = lstatSync(entry);
  } catch {
    throw new Error(`${name} is missing in ${appDir}`);
  }

  if (!details.isSymbolicLink()) return entry;

  const target = readlinkSync(entry);
  if (isAbsolute(target)) {
    throw new Error(`${name} must not point outside the AppDir: ${target}`);
  }

  const resolvedTarget = resolve(dirname(entry), target);
  try {
    statSync(resolvedTarget);
  } catch {
    throw new Error(`${name} has a broken symlink target: ${target}`);
  }
  return resolvedTarget;
}

export function validateAppImageLayout(appDir) {
  const root = resolve(appDir);
  const appRun = requirePortableEntry(root, "AppRun");
  if ((statSync(appRun).mode & 0o111) === 0) {
    throw new Error(`AppRun is not executable in ${root}`);
  }

  requirePortableEntry(root, ".DirIcon");

  const desktopEntries = readdirSync(root).filter((name) => name.endsWith(".desktop"));
  if (desktopEntries.length !== 1) {
    throw new Error(
      `${root} must contain exactly one root .desktop file; found ${desktopEntries.length}`,
    );
  }

  const desktopPath = requirePortableEntry(root, desktopEntries[0]);
  const iconName = readFileSync(desktopPath, "utf8")
    .split(/\r?\n/)
    .find((line) => line.startsWith("Icon="))
    ?.slice("Icon=".length)
    .trim();
  if (!iconName) {
    throw new Error(`${desktopEntries[0]} has no Icon entry`);
  }

  const iconCandidates = ["png", "svg", "xpm"].map((extension) =>
    join(root, `${iconName}.${extension}`),
  );
  if (!iconCandidates.some((candidate) => {
    try {
      statSync(candidate);
      return true;
    } catch {
      return false;
    }
  })) {
    throw new Error(
      `${desktopEntries[0]} references missing root icon ${iconName}.{png,svg,xpm}`,
    );
  }

  const metadataPath = requirePortableEntry(
    root,
    join("usr", "share", "metainfo", APPSTREAM_FILE),
  );
  const metadata = readFileSync(metadataPath, "utf8");
  const componentId = metadata.match(/<id>([^<]+)<\/id>/)?.[1]?.trim();
  if (componentId !== APPSTREAM_ID) {
    throw new Error(
      `${APPSTREAM_FILE} must use component id ${APPSTREAM_ID}; found ${componentId ?? "missing"}`,
    );
  }

  const launchable = metadata
    .match(/<launchable\s+type=["']desktop-id["']>([^<]+)<\/launchable>/)?.[1]
    ?.trim();
  if (launchable !== desktopEntries[0]) {
    throw new Error(
      `${APPSTREAM_FILE} launchable must match ${desktopEntries[0]}; found ${launchable ?? "missing"}`,
    );
  }

  const screenshot = metadata
    .match(/<screenshot\b[^>]*>[\s\S]*?<image>([^<]+)<\/image>[\s\S]*?<\/screenshot>/)?.[1]
    ?.trim();
  if (!screenshot?.startsWith("https://")) {
    throw new Error(`${APPSTREAM_FILE} must include an HTTPS screenshot URL`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const appDirs = process.argv.slice(2);
  if (appDirs.length === 0) {
    console.error("Usage: node scripts/check-appimage-layout.mjs <app.AppDir> [...]");
    process.exit(2);
  }

  try {
    for (const appDir of appDirs) {
      validateAppImageLayout(appDir);
      console.log(`AppImage layout OK: ${resolve(appDir)}`);
    }
  } catch (error) {
    console.error(`AppImage layout invalid: ${error.message}`);
    process.exit(1);
  }
}
