import { toast } from "sonner";

export default function openFile(
  accepts: string[],
  onFile: (file: File) => void,
) {
  const allowedExtensions = accepts
    .map((type) => `.${type}`)
    .map((s) => s.trim().toLowerCase());

  const input = document.createElement("input");
  input.type = "file";
  input.accept = allowedExtensions.join(",");
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (!allowedExtensions.includes(ext)) {
      toast.error(
        `File type not supported. Accepted: ${allowedExtensions.join(", ")}`,
      );
      return;
    }

    onFile(file);
  };
  setTimeout(() => input.click(), 0);
}
