export const isEqual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
