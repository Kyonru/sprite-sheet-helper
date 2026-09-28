import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertAppVersionsInSync } from "../../scripts/check-version-sync.mjs";
import { syncAppVersions } from "../../scripts/sync-version.mjs";

const tempRoots: string[] = [];

async function createFixture(version = "1.2.3") {
  const root = await mkdtemp(join(tmpdir(), "ssh-version-sync-"));
  tempRoots.push(root);
  await mkdir(join(root, "src-tauri"));

  await Promise.all([
    writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "spritesheet-helper", version }, null, 2) + "\n",
    ),
    writeFile(
      join(root, "package-lock.json"),
      JSON.stringify(
        {
          name: "spritesheet-helper",
          version: "0.1.0",
          lockfileVersion: 3,
          packages: {
            "": { name: "spritesheet-helper", version: "0.1.0" },
          },
        },
        null,
        2,
      ) + "\n",
    ),
    writeFile(
      join(root, "src-tauri/Cargo.toml"),
      '[package]\nname = "app"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1.0"\n',
    ),
    writeFile(
      join(root, "src-tauri/Cargo.lock"),
      'version = 4\n\n[[package]]\nname = "app"\nversion = "0.1.0"\ndependencies = [\n "serde",\n]\n\n[[package]]\nname = "serde"\nversion = "1.0.0"\n',
    ),
    writeFile(
      join(root, "src-tauri/tauri.conf.json"),
      JSON.stringify({ productName: "spritesheet-helper", version: "0.1.0" }, null, 2) +
        "\n",
    ),
    writeFile(join(root, "CHANGELOG.md"), `# Changelog\n\n## [${version}]\n`),
  ]);

  return root;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("app version synchronization", () => {
  it("copies package.json's version into every managed version source", async () => {
    const root = await createFixture();

    const result = syncAppVersions(root);

    expect(result).toEqual({
      version: "1.2.3",
      changed: [
        "package-lock.json",
        "src-tauri/Cargo.toml",
        "src-tauri/Cargo.lock",
        "src-tauri/tauri.conf.json",
      ],
    });
    expect(() => assertAppVersionsInSync(undefined, root)).not.toThrow();
    expect(await readFile(join(root, "src-tauri/Cargo.toml"), "utf8")).toContain(
      'serde = "1.0"',
    );
    expect(await readFile(join(root, "src-tauri/Cargo.lock"), "utf8")).toContain(
      'name = "serde"\nversion = "1.0.0"',
    );
  });

  it("is idempotent after the first synchronization", async () => {
    const root = await createFixture("2.0.0-beta.1");

    syncAppVersions(root);

    expect(syncAppVersions(root)).toEqual({
      version: "2.0.0-beta.1",
      changed: [],
    });
  });

  it("finds the app package in a Cargo lockfile with Windows line endings", async () => {
    const root = await createFixture();
    const cargoLock = [
      "version = 4",
      "",
      "[[package]]",
      'name = "adler2"',
      'version = "2.0.1"',
      'source = "registry+https://github.com/rust-lang/crates.io-index"',
      "",
      "[[package]]",
      'name = "app"',
      'version = "0.1.0"',
      "dependencies = []",
      "",
    ].join("\r\n");
    await writeFile(join(root, "src-tauri/Cargo.lock"), cargoLock);

    syncAppVersions(root);

    expect(() => assertAppVersionsInSync(undefined, root)).not.toThrow();
    expect(await readFile(join(root, "src-tauri/Cargo.lock"), "utf8")).toContain(
      'name = "adler2"\r\nversion = "2.0.1"',
    );
  });

  it("rejects an invalid package.json version before writing", async () => {
    const root = await createFixture("next");
    const originalLock = await readFile(join(root, "package-lock.json"), "utf8");

    expect(() => syncAppVersions(root)).toThrow(
      "package.json has an invalid semantic version: next",
    );
    expect(await readFile(join(root, "package-lock.json"), "utf8")).toBe(
      originalLock,
    );
  });
});
