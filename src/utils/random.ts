export const getRandomInRange = (
  min: number,
  max: number,
  randomizeSign = false
) => {
  const value = Math.random() * (max - min) + min;

  if (randomizeSign) {
    return value * (Math.random() < 0.5 ? 1 : -1);
  }

  return value;
};

export const getRandomVector2 = (
  min: number,
  max: number,
  options: { x?: number; y?: number; randomizeSign?: boolean } = {}
) => {
  const x = options.x ?? getRandomInRange(min, max, options.randomizeSign);
  const y = options.y ?? getRandomInRange(min, max, options.randomizeSign);
  return [x, y];
};

export const getRandomVector3 = (
  min: number,
  max: number,
  options: { x?: number; y?: number; z?: number; randomizeSign?: boolean } = {}
) => {
  const x = options.x ?? getRandomInRange(min, max, options.randomizeSign);
  const y = options.y ?? getRandomInRange(min, max, options.randomizeSign);
  const z = options.z ?? getRandomInRange(min, max, options.randomizeSign);

  return [x, y, z];
};

export const getRandomHexColor = () => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};
