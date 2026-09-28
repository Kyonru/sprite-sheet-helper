#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = import.meta.url.startsWith("file:")
  ? fileURLToPath(import.meta.url)
  : undefined;
const root = modulePath ? resolve(dirname(modulePath), "..") : process.cwd();

function readJson(rootDir, path) {
  return JSON.parse(readFileSync(resolve(rootDir, path), "utf8"));
}

function readCargoPackageVersion(rootDir, path, packageName) {
  const source = readFileSync(resolve(rootDir, path), "utf8");
  const blocks = source.split(/\r?\n(?=\[\[package\]\]\r?\n)/);
  const block = blocks.find((candidate) =>
    new RegExp(`^name = ["']${packageName}["']$`, "m").test(candidate),
  );
  return block?.match(/^version = ["']([^"']+)["']$/m)?.[1];
}

function readCargoManifestVersion(rootDir, path) {
  const source = readFileSync(resolve(rootDir, path), "utf8");
  const packageStart = source.indexOf("[package]");
  if (packageStart < 0) return undefined;
  const afterPackage = source.slice(packageStart + "[package]".length);
  const nextSection = afterPackage.search(/^\[/m);
  const packageSection = nextSection >= 0 ? afterPackage.slice(0, nextSection) : afterPackage;
  return packageSection?.match(/^version = ["']([^"']+)["']$/m)?.[1];
}

function readChangelogVersion(rootDir, path) {
  const source = readFileSync(resolve(rootDir, path), "utf8");
  return source.match(/^## \[(\d+\.\d+\.\d+(?:-[^\]]+)?)\]/m)?.[1];
}

function readAppStreamVersion(rootDir, path) {
  const source = readFileSync(resolve(rootDir, path), "utf8");
  return source.match(/<release\b[^>]*\bversion=["']([^"']+)["']/)?.[1];
}

function readTauriVersion(rootDir, path) {
  const configPath = resolve(rootDir, path);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (typeof config.version !== "string") return undefined;
  if (!config.version.endsWith(".json")) return config.version;
  return JSON.parse(
    readFileSync(resolve(dirname(configPath), config.version), "utf8"),
  ).version;
}

export function getAppVersions(rootDir = root) {
  const packageJson = readJson(rootDir, "package.json");
  const packageLock = readJson(rootDir, "package-lock.json");

  return {
    "package.json": packageJson.version,
    "package-lock.json": packageLock.version,
    "package-lock.json root package": packageLock.packages?.[""]?.version,
    "src-tauri/tauri.conf.json resolved version": readTauriVersion(
      rootDir,
      "src-tauri/tauri.conf.json",
    ),
    "src-tauri/Cargo.toml": readCargoManifestVersion(
      rootDir,
      "src-tauri/Cargo.toml",
    ),
    "src-tauri/Cargo.lock app package": readCargoPackageVersion(
      rootDir,
      "src-tauri/Cargo.lock",
      "app",
    ),
    "AppStream latest release": readAppStreamVersion(
      rootDir,
      "src-tauri/com.kyonru.spritesheethelper.metainfo.xml",
    ),
    "CHANGELOG.md latest entry": readChangelogVersion(rootDir, "CHANGELOG.md"),
  };
}

export function assertAppVersionsInSync(
  expectedTag = process.env.GITHUB_REF_NAME,
  rootDir = root,
) {
  const versions = getAppVersions(rootDir);
  const expected = versions["package.json"];
  const mismatches = Object.entries(versions).filter(([, version]) => version !== expected);

  if (mismatches.length > 0) {
    const details = Object.entries(versions)
      .map(([source, version]) => `  ${source}: ${version ?? "missing"}`)
      .join("\n");
    throw new Error(`App versions are not synchronized:\n${details}`);
  }

  if (expectedTag?.startsWith("v") && expectedTag !== `v${expected}`) {
    throw new Error(`Release tag ${expectedTag} does not match app version v${expected}`);
  }

  return expected;
}

const isMain =
  modulePath && process.argv[1] && modulePath === resolve(process.argv[1]);
if (isMain) {
  try {
    const version = assertAppVersionsInSync();
    console.log(`App versions are synchronized at ${version}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
