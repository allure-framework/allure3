import { pathToFileURL } from "node:url";

/**
 * The function appends `file:///` protocol to the absolute paths on Windows due to ES modules imports specifics
 * @param path
 */
export const normalizeImportPath = (path: string) => {
  return pathToFileURL(path).href;
};
