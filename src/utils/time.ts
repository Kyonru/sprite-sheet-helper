export function scheduleInterval(
  callback: () => void,
  interval: number,
  iterations: number,
  onTick?: () => void,
  onComplete?: () => void,
): NodeJS.Timeout {
  let count = 0;

  const id = setInterval(() => {
    callback();
    count++;
    onTick?.();

    if (count >= iterations) {
      clearInterval(id);

      if (onComplete) {
        onComplete();
      }
    }
  }, interval);

  return id;
}
