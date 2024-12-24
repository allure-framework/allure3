import { platform } from "node:os";
import { win32 } from "node:path";

/**
 * The function appends `file:///` protocol to the absolute paths on Windows due to ES modules imports specifics
 * @param path
 */
export const normalizeImportPath = (path: string) => {
  if (!path) {
    return path;
  }

  if (platform() === "win32") {
    const { root } = win32.parse(path);

    return root ? `file:///${path}` : path;
  }

  return path;
};
