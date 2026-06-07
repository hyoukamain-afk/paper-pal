#!/usr/bin/env node
/** One-shot recovery: kill zombies, clear Vite cache, verify files, then start dev. */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

execSync("node scripts/ensure-dev.mjs", { stdio: "inherit" });

for (const dir of ["node_modules/.vite", "node_modules/.vite-temp"]) {
  try {
    rmSync(dir, { recursive: true, force: true });
    console.log(`Removed ${dir}`);
  } catch {
    /* */
  }
}

console.log("\nStarting dev server…\n");
execSync("vite dev", { stdio: "inherit" });
