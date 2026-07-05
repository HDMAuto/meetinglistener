const VERSION_RE = /(\d+)\.(\d+)\.(\d+)/;

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// Highest X.Y.Z found in installer filenames; null when none qualify.
export function latestVersionFrom(names: string[]): string | null {
  let best: number[] | null = null;
  for (const name of names) {
    if (name.startsWith(".") || name.endsWith(".blockmap")) continue;
    const m = VERSION_RE.exec(name);
    if (!m) continue;
    const v = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!best || compare(v, best) > 0) best = v;
  }
  return best ? best.join(".") : null;
}
