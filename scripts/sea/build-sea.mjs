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
 *   3. Generate the SEA preparation blob and inject it into the target platform's
 *      Node.js binary with postject.
 *
 * The bundle and the blob are platform-independent (we keep useCodeCache /
 * useSnapshot off), so a binary for any OS/arch can be produced from any host.
 * When the target differs from the host, the matching official Node.js binary
 * (same version as the running Node) is downloaded and cached under out/sea/.node-cache.
 *
 * Usage:
 *   yarn build && yarn build:sea                 # build for the host platform
 *   yarn build:sea --platform linux --arch x64   # cross-build for linux-x64
 *   yarn build:sea:linux                         # shorthand for linux-x64
 *
 * Output: out/sea/<platform>-<arch>/allure (or allure.exe for windows targets)
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");
const { pnpPlugin } = require("@yarnpkg/esbuild-plugin-pnp");
const { inject } = require("postject");

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(rootDir, "out", "sea");
const nodeCacheDir = join(outDir, ".node-cache");
const entryPoint = join(rootDir, "packages", "cli", "dist", "sea.js");
const shimPath = join(rootDir, "scripts", "sea", "import-meta-url-shim.mjs");
const bundlePath = join(outDir, "allure.cjs");
const blobPath = join(outDir, "sea-prep.blob");
const seaConfigPath = join(outDir, "sea-config.json");

const SENTINEL_FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
const SUPPORTED_PLATFORMS = new Set(["linux", "darwin", "win32"]);
const SUPPORTED_ARCHES = new Set(["x64", "arm64"]);

// packages whose dist files are resolved with require.resolve()/readFile() at runtime
const WEB_PACKAGES = ["web-awesome", "web-classic", "web-dashboard", "web-summary"];

const parseTarget = () => {
  const args = process.argv.slice(2);
  let platform = process.platform;
  let arch = process.arch;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--platform" || arg === "--os") {
      platform = args[++i];
    } else if (arg === "--arch") {
      arch = args[++i];
    } else if (arg.startsWith("--platform=")) {
      platform = arg.slice("--platform=".length);
    } else if (arg.startsWith("--arch=")) {
      arch = arg.slice("--arch=".length);
    } else if (arg === "--target" || arg.startsWith("--target=")) {
      const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[++i];
      [platform, arch] = value.split("-");
    }
  }

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`unsupported target platform "${platform}" (expected one of ${[...SUPPORTED_PLATFORMS].join(", ")})`);
  }

  if (!SUPPORTED_ARCHES.has(arch)) {
    throw new Error(`unsupported target arch "${arch}" (expected one of ${[...SUPPORTED_ARCHES].join(", ")})`);
  }

  return { platform, arch };
};

const downloadFile = async (url, dest) => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
};

const sha256 = async (path) => {
  const hash = createHash("sha256");

  await pipeline(createReadStream(path), hash);

  return hash.digest("hex");
};

/**
 * Returns the path to a Node.js binary for the given target platform/arch,
 * matching the version of the Node.js running this script (a hard SEA
 * requirement). Uses the host binary when the target matches, otherwise
 * downloads and caches the official distribution.
 */
const resolveTargetNode = async (platform, arch) => {
  if (platform === process.platform && arch === process.arch) {
    return process.execPath;
  }

  const version = process.version; // e.g. "v24.17.0"
  const isWin = platform === "win32";
  const nodeOs = isWin ? "win" : platform; // linux | darwin | win
  const ext = isWin ? "zip" : "tar.gz";
  const dirName = `node-${version}-${nodeOs}-${arch}`;
  const archiveName = `${dirName}.${ext}`;
  const archivePath = join(nodeCacheDir, archiveName);
  const nodeBinary = isWin ? join(nodeCacheDir, dirName, "node.exe") : join(nodeCacheDir, dirName, "bin", "node");

  if (existsSync(nodeBinary)) {
    return nodeBinary;
  }

  mkdirSync(nodeCacheDir, { recursive: true });

  const baseUrl = `https://nodejs.org/dist/${version}`;

  console.log(`downloading ${archiveName} (target Node.js binary)...`);
  await downloadFile(`${baseUrl}/${archiveName}`, archivePath);

  const shasums = await (await fetch(`${baseUrl}/SHASUMS256.txt`)).text();
  const expected = shasums
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .find(([, name]) => name === archiveName)?.[0];

  if (!expected) {
    throw new Error(`could not find checksum for ${archiveName} in SHASUMS256.txt`);
  }

  const actual = await sha256(archivePath);

  if (actual !== expected) {
    throw new Error(`checksum mismatch for ${archiveName}: expected ${expected}, got ${actual}`);
  }

  if (isWin) {
    execFileSync("unzip", ["-oq", archivePath, "-d", nodeCacheDir], { stdio: "inherit" });
  } else {
    execFileSync("tar", ["-xzf", archivePath, "-C", nodeCacheDir], { stdio: "inherit" });
  }

  if (!existsSync(nodeBinary)) {
    throw new Error(`extracted archive but did not find ${nodeBinary}`);
  }

  return nodeBinary;
};

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

const generateBlob = () => {
  const assets = collectAssets();
  const seaConfig = {
    main: bundlePath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    // must stay false for a portable, cross-platform blob (code cache/snapshot
    // are tied to the building machine's platform)
    useCodeCache: false,
    useSnapshot: false,
    assets,
  };

  writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

  console.log(`generating SEA blob (${Object.keys(assets).length} embedded assets)...`);
  execFileSync(process.execPath, ["--experimental-sea-config", seaConfigPath], { stdio: "inherit" });
};

const buildExecutable = async (platform, arch) => {
  const targetNode = await resolveTargetNode(platform, arch);
  const isWin = platform === "win32";
  const isDarwin = platform === "darwin";
  const targetDir = join(outDir, `${platform}-${arch}`);
  const binaryPath = join(targetDir, isWin ? "allure.exe" : "allure");

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(targetNode, binaryPath);
  chmodSync(binaryPath, 0o755);

  // codesign manipulation only makes sense for a macOS binary on a macOS host
  const canCodesign = isDarwin && process.platform === "darwin";

  if (canCodesign) {
    execFileSync("codesign", ["--remove-signature", binaryPath], { stdio: "inherit" });
  }

  await inject(binaryPath, "NODE_SEA_BLOB", readFileSync(blobPath), {
    sentinelFuse: SENTINEL_FUSE,
    machoSegmentName: isDarwin ? "NODE_SEA" : undefined,
  });

  if (canCodesign) {
    execFileSync("codesign", ["--sign", "-", binaryPath], { stdio: "inherit" });
  } else if (isDarwin) {
    console.warn("warning: building a macOS binary on a non-macOS host; it will need `codesign --sign -` before running");
  }

  chmodSync(binaryPath, 0o755);
  console.log(`SEA binary is ready: ${relative(process.cwd(), binaryPath)} (${platform}-${arch})`);
};

const { platform, arch } = parseTarget();

mkdirSync(outDir, { recursive: true });

try {
  await bundle();
  generateBlob();
  await buildExecutable(platform, arch);
} catch (err) {
  console.error(err);
  process.exit(1);
}
