import { createRequire } from "node:module";

import { normalizeImportPath } from "./path.js";

const require = createRequire(import.meta.url);

export const resolveModulePath = (specifier: string): string => require.resolve(specifier);

export const isPackageEntry = (entry: string, packageName: string): boolean => {
  try {
    // Resolve from the candidate's installation, which may differ from core's dependency tree.
    return createRequire(entry).resolve(packageName) === entry;
  } catch {
    return false;
  }
};

/**
 * Dead simple wrapper around import function to make it possible to mock it in the tests
 * @param path
 */
export const importWrapper = async (path: string) => {
  return import(normalizeImportPath(path));
};
