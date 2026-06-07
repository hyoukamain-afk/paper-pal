#!/usr/bin/env node
/**
 * Run before `npm run dev`. Prevents the failure modes seen in debugging:
 * - hollow package.json/tsconfig (0 bytes on disk, size in metadata)
 * - zombie node holding port 8080
 * - multiple stuck vite dev processes
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const cwd = root.toLowerCase();

if (cwd.includes("/documents/") || cwd.includes("icloud")) {
  console.warn(
    "⚠ Project is under Documents/iCloud. Vite often hangs or files go empty (0 bytes on disk).\n" +
      "  Move the folder once:  mv \"~/Documents/My Apps/Paper Pal\" ~/Projects/paper-pal\n" +
      "  Then:  cd ~/Projects/paper-pal && rm -rf node_modules && npm install && npm run dev\n",
  );
}

const required = ["package.json", "tsconfig.json", "vite.config.ts", "src/server.ts"];

for (const file of required) {
  const path = join(root, file);
  let bytes;
  try {
    bytes = readFileSync(path);
  } catch {
    console.error(`\n❌ Missing ${file}\n`);
    process.exit(1);
  }
  if (bytes.length < 20) {
    console.error(
      `\n❌ ${file} is empty on disk (${bytes.length} bytes read).\n` +
        `   Save it from the editor or restore from backup before running dev.\n`,
    );
    process.exit(1);
  }
}

try {
  JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
} catch (e) {
  console.error("\n❌ package.json is not valid JSON:", e.message, "\n");
  process.exit(1);
}

const rootRoute = readFileSync(join(root, "src/routes/__root.tsx"), "utf8");
if (rootRoute.includes('Hello "__root"!') || !rootRoute.includes("HeadContent")) {
  console.error(
    "\n❌ src/routes/__root.tsx is the TanStack placeholder (no layout/styles).\n" +
      "   Restore the Paperly root route — see git history or ask Cursor to fix it.\n",
  );
  process.exit(1);
}

function killPids(signal, pattern) {
  try {
    const out = execSync(`pgrep -f ${JSON.stringify(pattern)}`, { encoding: "utf8" }).trim();
    if (!out) return;
    for (const pid of out.split("\n")) {
      try {
        process.kill(Number(pid), signal);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* no matches */
  }
}

killPids("SIGTERM", "Paper Pal/node_modules/.bin/vite");
killPids("SIGTERM", "Paper Pal/node_modules/.bin/vite dev");

try {
  const pids = execSync("lsof -ti :8080 2>/dev/null", { encoding: "utf8" }).trim();
  if (pids) {
    for (const pid of pids.split("\n")) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {
        /* */
      }
    }
    console.warn("⚠ Cleared port 8080 (was in use).");
  }
} catch {
  /* port free */
}

console.log("✓ Dev prerequisites OK — starting Vite (wait for “ready” before opening the browser).\n");
