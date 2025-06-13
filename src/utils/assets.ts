import GIF from "gif.js.optimized";

export async function createSpriteSheet(
  images: string[][],
  xWidth: number,
  xHeight: number
): Promise<string> {
  const rows = images.length;
  const cols = Math.max(...images.map((row) => row.length));

  // Flatten and load all images
  const flatImages = images.flat();
  const loadedImages = await Promise.all(
    flatImages.map((src) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = "data:image/png;base64," + src;
      });
    })
  );

  const canvas = document.createElement("canvas");
  canvas.width = cols * xWidth;
  canvas.height = rows * xHeight;
  const ctx = canvas.getContext("2d")!;

  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < images[row].length; col++) {
      const x = col * xWidth;
      const y = row * xHeight;
      const img = loadedImages[i++];
      ctx.drawImage(img, x, y, xWidth, xHeight);
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

    images.forEach((src, index) => {
      const img = new Image();
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
