/**
 * Builds the Allure CLI as a Node.js Single Executable Application (SEA),
 * so it can run on machines without Node.js installed (e.g. minimal CI images).
 *
 * The pipeline:
 *   1. Bundle the pre-built CLI (`packages/cli/dist/sea.js`) into a single CommonJS
 *      file with esbuild (Yarn PnP aware via @yarnpkg/esbuild-plugin-pnp).
 *   2. Embed runtime-resolved static files (web report bundles, package manifests)
 *      as SEA assets; they are extracted to a temp dir on startup by
 *      scripts/sea/import-meta-url-shim.mjs.
 *   3. Generate the SEA preparation blob and inject it into a copy of the
 *      Node.js binary with postject.
 *
 * Usage: yarn build && yarn build:sea
 * Output: out/sea/allure (or allure.exe on Windows)
 */
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const { pnpPlugin } = require("@yarnpkg/esbuild-plugin-pnp");
const { inject } = require("postject");

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(rootDir, "out", "sea");
const entryPoint = join(rootDir, "packages", "cli", "dist", "sea.js");
const shimPath = join(rootDir, "scripts", "sea", "import-meta-url-shim.mjs");
const bundlePath = join(outDir, "allure.cjs");
const blobPath = join(outDir, "sea-prep.blob");
const seaConfigPath = join(outDir, "sea-config.json");
const binaryName = process.platform === "win32" ? "allure.exe" : "allure";
const binaryPath = join(outDir, binaryName);

const SENTINEL_FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

// packages whose dist files are resolved with require.resolve()/readFile() at runtime
const WEB_PACKAGES = ["web-awesome", "web-classic", "web-dashboard", "web-summary"];

const collectFiles = (dir) => {
  const files = [];

  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) {
      files.push(join(entry.parentPath, entry.name));
    }
  }

  return files;
};

const toAssetKey = (...segments) => segments.join("/").replaceAll("\\", "/");

const collectAssets = () => {
  const assets = {};

  for (const pkg of WEB_PACKAGES) {
    const pkgDir = join(rootDir, "packages", pkg);
    const distDir = join(pkgDir, "dist");

    if (!existsSync(distDir)) {
      throw new Error(`missing ${distDir}; run "yarn build" first`);
    }

    assets[toAssetKey("node_modules", "@allurereport", pkg, "package.json")] = join(pkgDir, "package.json");

    for (const file of collectFiles(distDir)) {
      assets[toAssetKey("node_modules", "@allurereport", pkg, "dist", relative(distDir, file))] = file;
    }
  }

  // the extracted tree mimics an installed "allure" package: the runtime shim points
  // import.meta.url at node_modules/allure/dist/index.js, so relative reads like
  // new URL("../package.json", import.meta.url) and the allure2 static lookup keep working
  const allure2StaticDir = join(rootDir, "packages", "plugin-allure2", "static");

  for (const file of collectFiles(allure2StaticDir)) {
    assets[toAssetKey("node_modules", "allure", "static", relative(allure2StaticDir, file))] = file;
  }

  const cliPkg = JSON.parse(readFileSync(join(rootDir, "packages", "cli", "package.json"), "utf8"));
  const syntheticPkg = JSON.stringify(
    { name: cliPkg.name, description: cliPkg.description, version: cliPkg.version },
    null,
    2,
  );
  const syntheticPkgPath = join(outDir, "package.json.sea");

  writeFileSync(syntheticPkgPath, syntheticPkg);
  // also next to the bundle, so `node out/sea/allure.cjs` works for debugging
  writeFileSync(join(rootDir, "out", "package.json"), syntheticPkg);
  assets[toAssetKey("node_modules", "allure", "package.json")] = syntheticPkgPath;

  // the "open" package spawns its bundled xdg-open script on Linux, resolving it
  // relative to import.meta.url, which the shim points at node_modules/allure/dist
  try {
    const staticServerRequire = createRequire(join(rootDir, "packages", "static-server", "package.json"));
    const xdgOpenSource = join(dirname(staticServerRequire.resolve("open")), "xdg-open");
    const xdgOpenTarget = join(outDir, "xdg-open");

    // read through PnP-patched fs (the source lives inside a zip archive)
    writeFileSync(xdgOpenTarget, readFileSync(xdgOpenSource));
    assets[toAssetKey("node_modules", "allure", "dist", "xdg-open")] = xdgOpenTarget;
  } catch (err) {
    console.warn(`warning: failed to embed xdg-open ("open --open" may not work on Linux): ${err.message}`);
  }

  return assets;
};

const bundle = async () => {
  if (!existsSync(entryPoint)) {
    throw new Error(`missing ${entryPoint}; run "yarn build" first`);
  }

  await esbuild.build({
    entryPoints: [entryPoint],
    outfile: bundlePath,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    keepNames: true,
    sourcemap: false,
    logLevel: "info",
    // preserve native import() so that user configs (allurerc.mjs) can still be
    // loaded through the real ESM loader at runtime, which works inside a SEA
    supported: { "dynamic-import": true },
    inject: [shimPath],
    define: { "import.meta.url": "seaImportMetaUrl" },
    plugins: [pnpPlugin()],
  });
};

const buildExecutable = () => {
  const assets = collectAssets();
  const seaConfig = {
    main: bundlePath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    assets,
  };

  writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

  console.log(`generating SEA blob (${Object.keys(assets).length} embedded assets)...`);
  execFileSync(process.execPath, ["--experimental-sea-config", seaConfigPath], { stdio: "inherit" });

  copyFileSync(process.execPath, binaryPath);

  if (process.platform === "darwin") {
    execFileSync("codesign", ["--remove-signature", binaryPath], { stdio: "inherit" });
  }

  return inject(binaryPath, "NODE_SEA_BLOB", readFileSync(blobPath), {
    sentinelFuse: SENTINEL_FUSE,
    machoSegmentName: process.platform === "darwin" ? "NODE_SEA" : undefined,
  }).then(() => {
    if (process.platform === "darwin") {
      execFileSync("codesign", ["--sign", "-", binaryPath], { stdio: "inherit" });
    }

    chmodSync(binaryPath, 0o755);
    console.log(`SEA binary is ready: ${relative(process.cwd(), binaryPath)}`);
  });
};

mkdirSync(outDir, { recursive: true });

try {
  await bundle();
  await buildExecutable();
} catch (err) {
  console.error(err);
  process.exit(1);
}
