import type { ExportRow } from "@/types/file";
import { createSpriteSheet, createSpritesheetJSON } from "../assets";
import JSZip from "jszip";

export async function buildZip(
  populate: (zip: JSZip) => Promise<void> | void,
): Promise<string> {
  const zip = new JSZip();
  await populate(zip);
  return zip.generateAsync({ type: "base64" });
}

export async function buildSpritesheetAssets(exportedImages: ExportRow[]) {
  const dataUrl = await createSpriteSheet(exportedImages);
  const json = createSpritesheetJSON(exportedImages);
  const base64PNG = dataUrl.split("base64,")[1];
  return { json, base64PNG };
}
