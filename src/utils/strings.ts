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

export const toSnake = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/^([0-9])/, "_$1")
    .toLowerCase();

export const toPascal = (name: string) =>
  toSnake(name)
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
