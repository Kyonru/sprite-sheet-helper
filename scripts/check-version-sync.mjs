#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function readCargoPackageVersion(path, packageName) {
  const source = readFileSync(resolve(root, path), "utf8");
  const blocks = source.split(/\n(?=\[\[package\]\]\n)/);
  const block = blocks.find((candidate) =>
    new RegExp(`^name = ["']${packageName}["']$`, "m").test(candidate),
  );
  return block?.match(/^version = ["']([^"']+)["']$/m)?.[1];
}

function readCargoManifestVersion(path) {
  const source = readFileSync(resolve(root, path), "utf8");
  const packageStart = source.indexOf("[package]");
  if (packageStart < 0) return undefined;
  const afterPackage = source.slice(packageStart + "[package]".length);
  const nextSection = afterPackage.search(/^\[/m);
  const packageSection = nextSection >= 0 ? afterPackage.slice(0, nextSection) : afterPackage;
  return packageSection?.match(/^version = ["']([^"']+)["']$/m)?.[1];
}

function readChangelogVersion(path) {
  const source = readFileSync(resolve(root, path), "utf8");
  return source.match(/^## \[(\d+\.\d+\.\d+(?:-[^\]]+)?)\]/m)?.[1];
}

function readTauriVersion(path) {
  const configPath = resolve(root, path);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (typeof config.version !== "string") return undefined;
  if (!config.version.endsWith(".json")) return config.version;
  return JSON.parse(
    readFileSync(resolve(dirname(configPath), config.version), "utf8"),
  ).version;
}

export function getAppVersions() {
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");

  return {
    "package.json": packageJson.version,
    "package-lock.json": packageLock.version,
    "package-lock.json root package": packageLock.packages?.[""]?.version,
    "src-tauri/tauri.conf.json resolved version": readTauriVersion(
      "src-tauri/tauri.conf.json",
    ),
    "src-tauri/Cargo.toml": readCargoManifestVersion("src-tauri/Cargo.toml"),
    "src-tauri/Cargo.lock app package": readCargoPackageVersion(
      "src-tauri/Cargo.lock",
      "app",
    ),
    "CHANGELOG.md latest entry": readChangelogVersion("CHANGELOG.md"),
  };
}

export function assertAppVersionsInSync(expectedTag = process.env.GITHUB_REF_NAME) {
  const versions = getAppVersions();
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

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  try {
    const version = assertAppVersionsInSync();
    console.log(`App versions are synchronized at ${version}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
