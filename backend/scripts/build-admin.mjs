import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendDir, "..");
const adminDir = path.resolve(projectRoot, "admin");
const adminDistDir = path.join(adminDir, "dist");
const backendAdminPublicDir = path.join(backendDir, "public", "admin");

function log(message) {
  process.stdout.write(`${message}\n`);
}

function removeDirIfExists(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyDir(sourceDir, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });
  fs.cpSync(sourceDir, destinationDir, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(adminDir)) {
  log(`[build:admin] Skipping admin bundle copy because "${adminDir}" does not exist.`);
  process.exit(0);
}

log(`[build:admin] Building admin app from ${adminDir}`);

if (!fs.existsSync(path.join(adminDir, "node_modules"))) {
  log("[build:admin] Installing admin dependencies");
  run("npm", ["install"], adminDir);
}

run("npm", ["run", "build"], adminDir);

if (!fs.existsSync(adminDistDir)) {
  log(`[build:admin] Build completed but "${adminDistDir}" was not created.`);
  process.exit(1);
}

removeDirIfExists(backendAdminPublicDir);
copyDir(adminDistDir, backendAdminPublicDir);

log(`[build:admin] Copied admin build to ${backendAdminPublicDir}`);
