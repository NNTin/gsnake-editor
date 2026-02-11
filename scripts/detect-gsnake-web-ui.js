#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { spawnSync } from "child_process";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const packageJsonPath = join(projectRoot, "package.json");

const forceGitDeps = process.env.FORCE_GIT_DEPS === "1" || process.env.FORCE_GIT_DEPS === "true";

const localUiDir = join(projectRoot, "..", "gsnake-web", "packages", "gsnake-web-ui");
const localUiPackageJson = join(localUiDir, "package.json");
const rootGitPath = join(projectRoot, "..", ".git");

const vendorUiDir = join(projectRoot, "vendor", "gsnake-web-ui");
const vendorFiles = [
  "package.json",
  "index.js",
  "styles/app.css",
  "assets/sprites.svg",
  "components/Modal.svelte",
  "components/Overlay.svelte",
  "scripts/build-components.js",
];
const archiveUrl = "https://codeload.github.com/NNTin/gsnake-web/tar.gz/refs/heads/main";

const localDependency = "file:../gsnake-web/packages/gsnake-web-ui";
const vendorDependency = "file:./vendor/gsnake-web-ui";

const isRootRepo = !forceGitDeps && existsSync(rootGitPath) && existsSync(localUiPackageJson);

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `[detect-gsnake-web-ui] Command failed (${command} ${args.join(" ")}) with status ${result.status}`
    );
  }
}

function updateDependency(targetDependency, label) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const currentDependency = packageJson.dependencies["gsnake-web-ui"];

  if (currentDependency !== targetDependency) {
    console.log(
      `[detect-gsnake-web-ui] Updating dependency: ${currentDependency} -> ${targetDependency}`
    );
    packageJson.dependencies["gsnake-web-ui"] = targetDependency;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  }

  console.log(`[detect-gsnake-web-ui] Using ${label}`);
}

function ensureBuiltUiPackage(uiDir, label) {
  const modalDistPath = join(uiDir, "dist", "Modal.js");
  const overlayDistPath = join(uiDir, "dist", "Overlay.js");

  if (existsSync(modalDistPath) && existsSync(overlayDistPath)) {
    console.log(`[detect-gsnake-web-ui] ${label} already has precompiled dist output`);
    return;
  }

  console.log(`[detect-gsnake-web-ui] Building ${label} for precompiled component consumption`);

  if (!existsSync(join(uiDir, "node_modules"))) {
    runCommand("npm", ["install"], uiDir);
  }

  runCommand("npm", ["run", "build"], uiDir);
}

async function downloadVendorSnapshot() {
  console.log("[detect-gsnake-web-ui] Downloading gsnake-web-ui snapshot from main...");

  rmSync(vendorUiDir, { recursive: true, force: true });
  mkdirSync(dirname(vendorUiDir), { recursive: true });

  const tempDir = mkdtempSync(join(tmpdir(), "gsnake-web-ui-"));
  const archivePath = join(tempDir, "snapshot.tar.gz");
  const extractRoot = join(tempDir, "extract");
  mkdirSync(extractRoot, { recursive: true });

  const response = await fetch(archiveUrl);
  if (!response.ok) {
    throw new Error(
      `[detect-gsnake-web-ui] Failed to download snapshot archive: ${response.status}`
    );
  }

  writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
  runCommand("tar", ["-xzf", archivePath, "-C", extractRoot], projectRoot);

  const candidateDirs = [
    join(extractRoot, "gsnake-web-main", "packages", "gsnake-web-ui"),
    join(extractRoot, "gsnake-web-master", "packages", "gsnake-web-ui"),
  ];
  const snapshotDir = candidateDirs.find((path) => existsSync(join(path, "package.json")));

  if (!snapshotDir) {
    throw new Error(
      "[detect-gsnake-web-ui] Snapshot does not contain packages/gsnake-web-ui. Make sure gsnake-web main includes the monorepo layout."
    );
  }

  cpSync(snapshotDir, vendorUiDir, { recursive: true });
  rmSync(tempDir, { recursive: true, force: true });

  console.log("[detect-gsnake-web-ui] Snapshot downloaded");
}

async function ensureVendoredSnapshot() {
  const hasAllSourceFiles = vendorFiles.every((file) => existsSync(join(vendorUiDir, file)));

  if (!hasAllSourceFiles) {
    await downloadVendorSnapshot();
  } else {
    console.log("[detect-gsnake-web-ui] Vendored snapshot already present");
  }

  ensureBuiltUiPackage(vendorUiDir, "vendored gsnake-web-ui");
}

async function run() {
  console.log("[detect-gsnake-web-ui] Checking dependency context...");
  console.log(`[detect-gsnake-web-ui] FORCE_GIT_DEPS: ${forceGitDeps}`);

  if (isRootRepo) {
    console.log("[detect-gsnake-web-ui] Root repository mode detected");
    ensureBuiltUiPackage(localUiDir, "local gsnake-web-ui");
    updateDependency(localDependency, "local gsnake-web-ui dependency");
    return;
  }

  console.log("[detect-gsnake-web-ui] Standalone mode detected");
  await ensureVendoredSnapshot();
  updateDependency(vendorDependency, "vendored gsnake-web-ui dependency");
}

run()
  .then(() => {
    console.log("[detect-gsnake-web-ui] Done");
  })
  .catch((error) => {
    console.error(String(error));
    process.exit(1);
  });
