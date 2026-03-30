import { resolve } from "node:path";

import { isPathContainedInDir } from "./safeOutputPath.js";

export class UnsafeDumpPathError extends Error {
  constructor(entryName: string, reason?: string) {
    const suffix = reason ? ` (${reason})` : "";
    super(`Refusing to restore dump: unsafe attachment path ${JSON.stringify(entryName)}${suffix}`);
    this.name = "UnsafeDumpPathError";
  }
}

/**
 * Resolves a dump archive entry name to an absolute path under {@param rootDir}.
 * Rejects zip-slip (path outside root), absolute entry names, empty names, and NUL bytes.
 */
export function resolveDumpAttachmentPath(rootDir: string, entryName: string): string {
  if (entryName.length === 0) {
    throw new UnsafeDumpPathError(entryName, "empty name");
  }
  if (entryName.includes("\0")) {
    throw new UnsafeDumpPathError(entryName, "NUL byte");
  }

  const resolved = resolve(resolve(rootDir), entryName);

  if (!isPathContainedInDir(rootDir, resolved)) {
    throw new UnsafeDumpPathError(entryName);
  }

  return resolved;
}
