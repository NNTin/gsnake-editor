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
const packageLockPath = join(projectRoot, "package-lock.json");

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
const localLockResolved = "../gsnake-web/packages/gsnake-web-ui";
const vendorLockResolved = "vendor/gsnake-web-ui";

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

function updateDependency(targetDependency, label, targetResolved) {
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

  if (!existsSync(packageLockPath)) {
    console.log("[detect-gsnake-web-ui] package-lock.json not found, skipping lock update");
    return;
  }

  const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
  const packages = packageLock.packages ?? {};
  let lockChanged = false;

  const rootPackage = packages[""];
  if (!rootPackage || !rootPackage.dependencies) {
    console.warn(
      "[detect-gsnake-web-ui] Unexpected package-lock.json format for root package; skipping lock update"
    );
  } else if (rootPackage.dependencies["gsnake-web-ui"] !== targetDependency) {
    rootPackage.dependencies["gsnake-web-ui"] = targetDependency;
    lockChanged = true;
  }

  const nodeModule = packages["node_modules/gsnake-web-ui"] ?? {};
  if (nodeModule.resolved !== targetResolved || nodeModule.link !== true) {
    nodeModule.resolved = targetResolved;
    nodeModule.link = true;
    packages["node_modules/gsnake-web-ui"] = nodeModule;
    lockChanged = true;
  }

  if (!packages[targetResolved]) {
    const template = packages[localLockResolved] ?? packages[vendorLockResolved] ?? null;
    packages[targetResolved] = template
      ? JSON.parse(JSON.stringify(template))
      : { version: "0.1.0" };
    lockChanged = true;
  }

  if (lockChanged) {
    packageLock.packages = packages;
    writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + "\n");
    console.log(`[detect-gsnake-web-ui] Updated package-lock.json for ${label}`);
  } else {
    console.log(`[detect-gsnake-web-ui] package-lock.json already matches ${label}`);
  }
}

function ensureBuiltUiPackage(uiDir, label, options = {}) {
  const { skipPrebuildValidation = false } = options;
  const modalDistPath = join(uiDir, "dist", "Modal.js");
  const overlayDistPath = join(uiDir, "dist", "Overlay.js");

  if (existsSync(modalDistPath) && existsSync(overlayDistPath)) {
    console.log(`[detect-gsnake-web-ui] ${label} already has precompiled dist output`);
    return;
  }

  console.log(`[detect-gsnake-web-ui] Building ${label} for precompiled component consumption`);

  if (!existsSync(join(uiDir, "node_modules"))) {
    if (skipPrebuildValidation) {
      runCommand("npm", ["install", "--ignore-scripts"], uiDir);
    } else {
      runCommand("npm", ["install"], uiDir);
    }
  }

  if (skipPrebuildValidation) {
    runCommand("node", ["scripts/build-components.js"], uiDir);
    return;
  }

  runCommand("npm", ["run", "build"], uiDir);
}

function patchVendoredUiPackage(uiDir) {
  const packagePath = join(uiDir, "package.json");
  if (!existsSync(packagePath)) return;

  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  if (!pkg.scripts) return;

  let changed = false;

  if (pkg.scripts.prepare) {
    delete pkg.scripts.prepare;
    changed = true;
  }

  if (pkg.scripts.prebuild === "node ../../scripts/validate-sprites.js") {
    pkg.scripts.prebuild = "node -e \"console.log('Skipping vendored sprite validation')\"";
    changed = true;
  }

  if (changed) {
    writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
    console.log("[detect-gsnake-web-ui] Patched vendored gsnake-web-ui package scripts");
  }
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

  patchVendoredUiPackage(vendorUiDir);

  ensureBuiltUiPackage(vendorUiDir, "vendored gsnake-web-ui", {
    skipPrebuildValidation: true,
  });
}

async function run() {
  console.log("[detect-gsnake-web-ui] Checking dependency context...");
  console.log(`[detect-gsnake-web-ui] FORCE_GIT_DEPS: ${forceGitDeps}`);

  if (isRootRepo) {
    console.log("[detect-gsnake-web-ui] Root repository mode detected");
    ensureBuiltUiPackage(localUiDir, "local gsnake-web-ui");
    updateDependency(localDependency, "local gsnake-web-ui dependency", localLockResolved);
    return;
  }

  console.log("[detect-gsnake-web-ui] Standalone mode detected");
  await ensureVendoredSnapshot();
  updateDependency(vendorDependency, "vendored gsnake-web-ui dependency", vendorLockResolved);
}

run()
  .then(() => {
    console.log("[detect-gsnake-web-ui] Done");
  })
  .catch((error) => {
    console.error(String(error));
    process.exit(1);
  });
