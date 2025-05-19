export function scheduleInterval(
  callback: () => void,
  interval: number,
  iterations: number,
  onComplete?: () => void
): NodeJS.Timeout {
  let count = 0;

  const id = setInterval(() => {
    callback();
    count++;

    if (count >= iterations) {
      clearInterval(id);

      if (onComplete) {
        onComplete();
      }
    }
  }, interval);

  return id;
}
