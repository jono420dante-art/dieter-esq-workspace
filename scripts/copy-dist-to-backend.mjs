/**
 * Copy mureka-clone/dist → dieter-backend/static (production SPA for FastAPI).
 * CLI: node scripts/copy-dist-to-backend.mjs
 * Or import { copyDistToBackend } from "./copy-dist-to-backend.mjs"
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} rootDir - Repository root (folder containing mureka-clone and dieter-backend)
 */
export function copyDistToBackend(rootDir) {
  const dist = path.join(rootDir, "mureka-clone", "dist");
  const target = path.join(rootDir, "dieter-backend", "static");

  if (!fs.existsSync(dist)) {
    console.error("Missing mureka-clone/dist — run a Vite build first (npm run build in mureka-clone).");
    process.exit(1);
  }

  fs.mkdirSync(target, { recursive: true });
  for (const name of fs.readdirSync(target)) {
    fs.rmSync(path.join(target, name), { recursive: true, force: true });
  }
  for (const name of fs.readdirSync(dist)) {
    fs.cpSync(path.join(dist, name), path.join(target, name), { recursive: true });
  }

  console.log(`Copied Vite dist → ${target}`);
}

const isMain =
  import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href;
if (isMain) {
  copyDistToBackend(path.resolve(__dirname, ".."));
}
