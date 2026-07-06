/**
 * This module is injected into the SEA bundle by esbuild, and every `import.meta.url`
 * expression in the bundle is rewritten to `seaImportMetaUrl` (see scripts/sea/build-sea.mjs).
 *
 * When running inside a Single Executable Application, module loading can't read
 * package files from disk, so all runtime-resolved static assets (web report bundles,
 * package manifests, etc.) are embedded into the executable as SEA assets. On startup
 * they are extracted into a temporary directory laid out as a regular `node_modules`
 * tree, and `seaImportMetaUrl` points inside it. This keeps `createRequire(import.meta.url)`,
 * `require.resolve("@allurereport/web-awesome/dist/single/main.js")` and
 * `new URL("../package.json", import.meta.url)` working unchanged.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import * as sea from "node:sea";
import { pathToFileURL } from "node:url";

const computeImportMetaUrl = () => {
  if (!sea.isSea()) {
    // plain `node bundle.cjs` execution (useful for debugging the bundle)
    return pathToFileURL(process.argv[1] ?? process.execPath).href;
  }

  const base = mkdtempSync(join(tmpdir(), "allure-sea-"));

  for (const key of sea.getAssetKeys()) {
    const target = join(base, ...key.split("/"));

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(sea.getRawAsset(key)));
  }

  process.once("exit", () => {
    try {
      rmSync(base, { recursive: true, force: true });
    } catch {
      // best-effort cleanup; the OS cleans the temp directory eventually
    }
  });

  return pathToFileURL(join(base, "node_modules", "allure", "dist", "index.js")).href;
};

export const seaImportMetaUrl = computeImportMetaUrl();
