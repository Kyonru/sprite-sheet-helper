import GIF from "gif.js.optimized";

export async function createSpriteSheet(
  images: string[],
  axis: "x" | "y" = "x",
  xWidth: number,
  xHeight: number
): Promise<string> {
  const loadedImages = await Promise.all(
    images.map((src) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = "data:image/png;base64," + src;
      });
    })
  );

  // Set canvas size based on custom dimensions
  const width = axis === "x" ? xWidth * images.length : xWidth;
  const height = axis === "y" ? xHeight * images.length : xHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  let x = 0;
  let y = 0;

  for (const img of loadedImages) {
    ctx.drawImage(img, x, y, xWidth, xHeight);
    if (axis === "x") {
      x += xWidth;
    } else {
      y += xHeight;
    }
  }

  return canvas.toDataURL("image/png");
}
export async function createGif(
  images: string[],
  width: number,
  height: number,
  delay: number,
  quality: number = 0,
  repeat: number = 0
): Promise<string> {
  return new Promise((resolve, reject) => {
    const gif = new GIF({
      repeat,
      workers: 2,
      quality,
      width,
      height,
      transparent: 0x00000000,
      workerScript: "/gif.worker.js", // Make sure this is served from `public/`
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject("Canvas context not available");

    let loaded = 0;

    console.log({ images, width, height, ctx });

    images.forEach((src, index) => {
      const img = new Image();
      console.log({ images });
      img.onload = () => {
        ctx.reset();
        ctx.drawImage(img, 0, 0, width, height);
        gif.addFrame(ctx, {
          delay,
          copy: true,
        });

        loaded++;
        if (loaded === images.length) {
          gif.on("finished", (blob: Blob) => {
            const url = URL.createObjectURL(blob);
            resolve(url);
          });
          gif.render();
        }
      };
      img.onerror = () => {
        reject(`Failed to load image at index ${index}`);
      };

      // Ensure it's a valid data URL
      img.src = src.startsWith("data:image")
        ? src
        : `data:image/png;base64,${src}`;
    });
  });
}

export const downloadFile = (href: string, name: string) => {
  const a = document.createElement("a");
  a.target = "_blank";
  a.href = href;
  a.download = name;
  a.click();
};
