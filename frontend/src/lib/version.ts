// True when candidate is strictly newer than current (numeric per segment;
// missing segments count as 0; malformed input is never "newer").
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = candidate.split(".").map((n) => parseInt(n, 10));
  const b = current.split(".").map((n) => parseInt(n, 10));
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return false;
    if (x !== y) return x > y;
  }
  return false;
}
