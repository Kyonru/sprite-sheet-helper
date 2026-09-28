#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateAppImageLayout } from "./check-appimage-layout.mjs";
import { assertAppVersionsInSync } from "./check-version-sync.mjs";

const args = process.argv.slice(2);
if (args[0] === "build") {
  try {
    const version = assertAppVersionsInSync();
    console.log(`App versions are synchronized at ${version}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

const executable = resolve(
  process.platform === "win32"
    ? "node_modules/.bin/tauri.cmd"
    : "node_modules/.bin/tauri",
);
const result = spawnSync(executable, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

if (process.platform === "linux" && args[0] === "build") {
  const targetIndex = args.indexOf("--target");
  const target = targetIndex >= 0 ? args[targetIndex + 1] : undefined;
  const profile = args.includes("--debug") ? "debug" : "release";
  const bundleDir = resolve(
    "src-tauri",
    "target",
    ...(target ? [target] : []),
    profile,
    "bundle",
    "appimage",
  );
  const appDirs = readdirSync(bundleDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".AppDir"))
    .map((entry) => join(bundleDir, entry.name));

  if (appDirs.length === 0) {
    console.error(`No AppDir found in ${bundleDir}`);
    process.exit(1);
  }

  try {
    for (const appDir of appDirs) {
      validateAppImageLayout(appDir);
      console.log(`AppImage layout OK: ${appDir}`);
    }
  } catch (error) {
    console.error(`AppImage layout invalid: ${error.message}`);
    process.exit(1);
  }
}
