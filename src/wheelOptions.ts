// Only the small fixed ranges used by the clinical date/time picker are retained.
const ranges = new Map<string, number[]>();
export function wheelRange(from: number, to: number): number[] {
  const key = `${from}:${to}`;
  let values = ranges.get(key);
  if (!values) {
    values = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    ranges.set(key, values);
  }
  return values;
}
