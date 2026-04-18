import JSZip from "jszip";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";

export async function extractToOutput(dataUrl: string, outputDir: string): Promise<string[]> {
  const base64 = dataUrl.split("base64,")[1];
  if (!base64) throw new Error("Unexpected data URL format");

  const buffer = Buffer.from(base64, "base64");
  const zip = await JSZip.loadAsync(buffer);

  await mkdir(outputDir, { recursive: true });

  const written: string[] = [];
  for (const [filename, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const content = await file.async("nodebuffer");
    const outPath = join(outputDir, filename);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, content);
    written.push(outPath);
  }

  return written;
}
