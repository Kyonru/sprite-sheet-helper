import JSZip from "jszip";

export async function zipEntries(base64: string): Promise<string[]> {
  const zip = await JSZip.loadAsync(Buffer.from(base64, "base64"));
  return Object.keys(zip.files).sort();
}

export async function zipDataUrl(files: Record<string, string>): Promise<string> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  const base64 = await zip.generateAsync({ type: "base64" });
  return `data:application/zip;base64,${base64}`;
}
