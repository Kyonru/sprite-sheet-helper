export function padArray<T>(arr: T[], targetLength: number): (T | undefined)[] {
  return arr.length >= targetLength
    ? arr
    : [...arr, ...Array(targetLength - arr.length)];
}
