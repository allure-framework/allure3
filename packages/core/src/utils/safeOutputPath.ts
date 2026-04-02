import { resolve, sep } from "node:path";

import { isWindows } from "./windows.js";

export class UnsafeReportOutputPathError extends Error {
  constructor(relativePath: string) {
    super(`Refusing to write outside report output directory: ${JSON.stringify(relativePath)}`);
    this.name = "UnsafeReportOutputPathError";
  }
}

/**
 * True when {@param candidatePath} resolves to {@param rootDir} or a path inside it.
 */
export function isPathContainedInDir(rootDir: string, candidatePath: string): boolean {
  const rootResolved = resolve(rootDir);
  const candidateResolved = resolve(candidatePath);

  if (isWindows()) {
    const rootLower = rootResolved.toLowerCase();
    const candLower = candidateResolved.toLowerCase();
    const prefix = rootLower.endsWith("\\") ? rootLower : `${rootLower}\\`;
    return candLower === rootLower || candLower.startsWith(prefix);
  }

  const prefix = rootResolved.endsWith(sep) ? rootResolved : `${rootResolved}${sep}`;
  return candidateResolved === rootResolved || candidateResolved.startsWith(prefix);
}

/**
 * Resolves a path relative to the report output root and rejects traversal outside that root.
 */
export function resolvePathUnderOutputRoot(outputRoot: string, relativePath: string): string {
  if (relativePath.includes("\0")) {
    throw new UnsafeReportOutputPathError(relativePath);
  }

  const rootResolved = resolve(outputRoot);
  const targetPath = resolve(rootResolved, relativePath);

  if (!isPathContainedInDir(rootResolved, targetPath)) {
    throw new UnsafeReportOutputPathError(relativePath);
  }

  return targetPath;
}
