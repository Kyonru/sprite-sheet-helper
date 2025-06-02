export async function createSpriteSheet(
  images: string[],
  axis: "x" | "y" = "x"
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

  let width = 0;
  let height = 0;

  if (axis === "y") {
    width = Math.max(...loadedImages.map((img) => img.width));
    height = loadedImages.reduce((sum, img) => sum + img.height, 0);
  } else {
    width = loadedImages.reduce((sum, img) => sum + img.width, 0);
    height = Math.max(...loadedImages.map((img) => img.height));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  let x = 0;
  let y = 0;

  if (axis === "y") {
    for (const img of loadedImages) {
      ctx.drawImage(img, 0, y);
      y += img.height;
    }
  } else {
    for (const img of loadedImages) {
      ctx.drawImage(img, x, 0);
      x += img.width;
    }
  }

  return canvas.toDataURL("image/png");
}

export const downloadFile = (href: string, name: string) => {
  const a = document.createElement("a");
  a.target = "_blank";
  a.href = href;
  a.download = name;
  a.click();
};
