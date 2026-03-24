/**
 * Build mureka-clone (Vite) and copy dist → dieter-backend/static.
 * No shell "&&" — works the same on Windows, macOS, and Linux.
 *
 * From repo root:  npm run build:backend
 * Or:             node scripts/build-frontend-to-backend.mjs
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { copyDistToBackend } from "./copy-dist-to-backend.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const mureka = path.join(root, "mureka-clone");

if (!fs.existsSync(path.join(mureka, "package.json"))) {
  console.error("mureka-clone not found. Expected:", mureka);
  process.exit(1);
}

// Run Vite with the same Node binary (no npm.cmd). On some Windows + Node versions,
// spawning npm.cmd fails with EINVAL; invoking vite.js directly is reliable.
const viteCli = path.join(mureka, "node_modules", "vite", "bin", "vite.js");
if (!fs.existsSync(viteCli)) {
  console.error("Vite not installed under mureka-clone. Run:\n  cd mureka-clone\n  npm ci");
  process.exit(1);
}
try {
  execFileSync(process.execPath, [viteCli, "build"], {
    cwd: mureka,
    stdio: "inherit",
    env: process.env,
  });
} catch (e) {
  const err = /** @type {NodeJS.ErrnoException & { status?: number }} */ (e);
  if (typeof err.status === "number") process.exit(err.status);
  throw e;
}

copyDistToBackend(root);
console.log("build:backend — OK. Start API from dieter-backend: uvicorn app.main:app --host 0.0.0.0 --port 8080");
