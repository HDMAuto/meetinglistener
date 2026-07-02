// Cross-platform replacement for `rm -rf renderer && cp -R ../frontend/dist renderer`
// so the build works on macOS and Windows alike.
import { rmSync, cpSync, existsSync } from "node:fs";

const dest = "renderer";
const src = "../frontend/dist";

if (!existsSync(src)) {
  console.error(`Renderer source not found: ${src} (did the frontend build run?)`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);
