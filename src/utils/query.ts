type Size = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

export const getBasedOnDisplaySize = ({
  xs,
  sm,
  md,
  lg,
  xl,
  xxl,
}: // eslint-disable-next-line @typescript-eslint/no-explicit-any
Record<Size, any>) => {
  const size = window.innerWidth;
  if (size < 768) {
    return xs;
  } else if (size < 1024) {
    return sm;
  } else if (size < 1280) {
    return md;
  } else if (size < 1536) {
    return lg;
  } else if (size < 1792) {
    return xl;
  } else {
    return xxl;
  }
};
