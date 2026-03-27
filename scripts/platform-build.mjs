/**
 * One-shot platform production build: ensure runtime dirs, then Vite → dieter-backend/static.
 * From repo root:  npm run platform:build
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

for (const rel of [
  path.join("dieter-backend", "voices", "man"),
  path.join("dieter-backend", "voices", "woman"),
  path.join("dieter-backend", "storage"),
]) {
  fs.mkdirSync(path.join(root, rel), { recursive: true });
}

const runner = path.join(root, "scripts", "build-frontend-to-backend.mjs");
execFileSync(process.execPath, [runner], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

console.log("");
console.log("Platform build OK — static SPA is in dieter-backend/static/");
console.log("  Run API:   cd dieter-backend && uvicorn app.main:app --host 0.0.0.0 --port 8080");
console.log("  Or stack:  docker compose up --build   → http://localhost:8080");
console.log("  Dev stack: mureka-clone/dev-stack.sh (Mac/Linux) or mureka-clone/dev-stack.ps1 (Windows)");
