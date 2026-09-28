import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateAppImageLayout } from "../../scripts/check-appimage-layout.mjs";

const tempRoots: string[] = [];

async function createAppDir(metadata?: string) {
  const root = await mkdtemp(join(tmpdir(), "ssh-appimage-layout-"));
  tempRoots.push(root);
  await mkdir(join(root, "usr/share/metainfo"), { recursive: true });
  await Promise.all([
    writeFile(join(root, "AppRun"), "#!/bin/sh\n"),
    writeFile(join(root, ".DirIcon"), "icon"),
    writeFile(
      join(root, "spritesheet-helper.desktop"),
      "[Desktop Entry]\nIcon=spritesheet-helper\n",
    ),
    writeFile(join(root, "spritesheet-helper.png"), "icon"),
  ]);
  await chmod(join(root, "AppRun"), 0o755);

  if (metadata) {
    await writeFile(
      join(
        root,
        "usr/share/metainfo/com.kyonru.spritesheethelper.metainfo.xml",
      ),
      metadata,
    );
  }
  return root;
}

const validMetadata = `
<component type="desktop-application">
  <id>com.kyonru.spritesheethelper</id>
  <launchable type="desktop-id">spritesheet-helper.desktop</launchable>
  <screenshots>
    <screenshot type="default">
      <image>https://example.com/main.png</image>
    </screenshot>
  </screenshots>
</component>
`;

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("AppImage layout validation", () => {
  it("accepts an AppDir with matching AppStream metadata", async () => {
    const root = await createAppDir(validMetadata);

    expect(() => validateAppImageLayout(root)).not.toThrow();
  });

  it("requires AppRun to be executable by every user", async () => {
    const root = await createAppDir(validMetadata);
    await chmod(join(root, "AppRun"), 0o770);

    expect(() => validateAppImageLayout(root)).toThrow(
      "AppRun is not executable by every user",
    );
  });

  it("requires the linuxdeploy wrapped launcher to be executable by every user", async () => {
    const root = await createAppDir(validMetadata);
    await writeFile(join(root, "AppRun.wrapped"), "launcher");
    await chmod(join(root, "AppRun.wrapped"), 0o770);

    expect(() => validateAppImageLayout(root)).toThrow(
      "AppRun.wrapped is not executable by every user",
    );
  });

  it("requires the AppStream metadata file", async () => {
    const root = await createAppDir();

    expect(() => validateAppImageLayout(root)).toThrow(
      "usr/share/metainfo/com.kyonru.spritesheethelper.metainfo.xml is missing",
    );
  });

  it("requires the launchable to match the root desktop file", async () => {
    const root = await createAppDir(
      validMetadata.replace(
        "spritesheet-helper.desktop",
        "different.desktop",
      ),
    );

    expect(() => validateAppImageLayout(root)).toThrow(
      "launchable must match spritesheet-helper.desktop",
    );
  });
});
