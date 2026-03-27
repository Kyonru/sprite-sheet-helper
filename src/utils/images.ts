export const addDataToImageIfNeeded = (image: string) => {
  if (image.startsWith("http")) {
    // if image is a url, add data to it, it doesn't contain data64
    return image;
  }

  if (image.startsWith("data:image")) {
    // if image is a data url, add data to it, it doesn't contain data64
    return image;
  }

  if (image.startsWith("blob:")) {
    // if image is a blob, add data to it, it doesn't contain data64
    return image;
  }

  return `data:image/png;base64,${image}`;
};
