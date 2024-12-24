import { normalizeImportPath } from "./path.js";

/**
 * Dead simple wrapper around import function to make it possible to mock it in the tests
 * @param path
 */
export const importWrapper = async (path: string) => {
  return import(normalizeImportPath(path));
};
