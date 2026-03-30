import { resolve, sep } from "node:path";

export class UnsafeDumpPathError extends Error {
  constructor(entryName: string, reason?: string) {
    const suffix = reason ? ` (${reason})` : "";
    super(`Refusing to restore dump: unsafe attachment path ${JSON.stringify(entryName)}${suffix}`);
    this.name = "UnsafeDumpPathError";
  }
}

function pathIsInsideDir(rootDir: string, candidatePath: string): boolean {
  const rootResolved = resolve(rootDir);
  const candidateResolved = resolve(candidatePath);

  if (process.platform === "win32") {
    const rootLower = rootResolved.toLowerCase();
    const candLower = candidateResolved.toLowerCase();
    const prefix = rootLower.endsWith("\\") ? rootLower : `${rootLower}\\`;
    return candLower === rootLower || candLower.startsWith(prefix);
  }

  const prefix = rootResolved.endsWith(sep) ? rootResolved : `${rootResolved}${sep}`;
  return candidateResolved === rootResolved || candidateResolved.startsWith(prefix);
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

  if (!pathIsInsideDir(rootDir, resolved)) {
    throw new UnsafeDumpPathError(entryName);
  }

  return resolved;
}
