import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { globSync } from "glob";

export const mergeBlobReports = (
  rootDirectory: string,
  mergedDirectory: string,
  blobPattern = "packages/*/.vitest/blob/*.json",
): number => {
  rmSync(mergedDirectory, { recursive: true, force: true });

  const blobs = globSync(blobPattern, { cwd: rootDirectory, absolute: true, nodir: true });

  if (blobs.length === 0) {
    throw new Error("No unit-test blob reports found.");
  }

  mkdirSync(mergedDirectory, { recursive: true });
  // Use unique filenames because each package writes the same report.json name.
  blobs.forEach((blob, index) => copyFileSync(blob, join(mergedDirectory, `${index}.json`)));
  return blobs.length;
};
