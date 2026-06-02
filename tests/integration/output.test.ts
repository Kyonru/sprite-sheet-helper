import { afterEach, describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import { join } from "path";
import { extractToOutput } from "../../cli/output";
import { zipDataUrl } from "../helpers/zip";
import { createTempDir, removeTempDir } from "../helpers/temp";

describe("extractToOutput", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) await removeTempDir(tempDir);
    tempDir = undefined;
  });

  it("writes nested files from a zip data URL", async () => {
    tempDir = await createTempDir("ssh-output-test-");
    const dataUrl = await zipDataUrl({
      "spritesheet.png": "png-bytes",
      "assets/spritesheet_normal.png": "normal-bytes",
      "src/main.rs": "source",
    });

    const written = await extractToOutput(dataUrl, tempDir);

    expect(written.map((path) => path.replace(tempDir!, ""))).toEqual([
      "/spritesheet.png",
      "/assets/spritesheet_normal.png",
      "/src/main.rs",
    ]);
    await expect(
      readFile(join(tempDir, "assets/spritesheet_normal.png"), "utf8"),
    ).resolves.toBe("normal-bytes");
  });
});
