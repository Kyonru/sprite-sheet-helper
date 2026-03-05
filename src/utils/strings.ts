export const generateUUID = () => {
  return crypto.randomUUID();
};

export const capitalize = (str: string, everyWord = false) => {
  const words = str.split(" ");

  if (everyWord) {
    return words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
};
