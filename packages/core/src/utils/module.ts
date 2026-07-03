import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";

import { normalizeImportPath } from "./path.js";

const require = createRequire(import.meta.url);

/**
 * Resolves a module path, first relative to this package (so bundled/installed
 * first-party dependencies are found), then relative to the user's current
 * working directory (so externally installed plugins are found too).
 *
 * The cwd fallback is required for bundled distributions (e.g. Single Executable
 * Applications), where this module is executed from a temporary extraction
 * directory that doesn't contain the user's `node_modules`.
 * @param path
 */
const resolveModulePath = (path: string): string => {
  try {
    return require.resolve(path);
  } catch (err) {
    try {
      // the base file doesn't need to exist; Node only uses its directory to
      // start walking up the node_modules chain of the user's project
      const cwdRequire = createRequire(join(process.cwd(), "__allure_resolve__.js"));

      return cwdRequire.resolve(path);
    } catch {
      // surface the original error so callers can react to module-not-found consistently
      throw err;
    }
  }
};

/**
 * Dead simple wrapper around import function to make it possible to mock it in the tests
 * @param path
 */
export const importWrapper = async (path: string) => {
  return import(normalizeImportPath(resolveModulePath(path)));
};
