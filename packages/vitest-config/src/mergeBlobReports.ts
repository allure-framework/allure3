import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export const mergeBlobReports = (rootDirectory: string, mergedDirectory: string): number => {
  rmSync(mergedDirectory, { recursive: true, force: true });

  const packagesDirectory = join(rootDirectory, "packages");
  const blobs: string[] = [];

  for (const entry of readdirSync(packagesDirectory, { withFileTypes: true })) {
    const directory = join(packagesDirectory, entry.name);
    const manifest = join(directory, "package.json");

    if (!entry.isDirectory() || !existsSync(manifest)) {
      continue;
    }

    const { scripts } = JSON.parse(readFileSync(manifest, "utf8"));
    if (!scripts?.["test:unit"]) {
      continue;
    }

    const blobDirectory = join(directory, "coverage", "blob");
    const reports = existsSync(blobDirectory)
      ? readdirSync(blobDirectory, { withFileTypes: true }).filter(
          (file) => file.isFile() && file.name.endsWith(".json"),
        )
      : [];

    if (reports.length === 0) {
      throw new Error(`${entry.name}: missing unit-test blob reports. Run the unit tests before merging coverage.`);
    }

    blobs.push(...reports.map((file) => join(blobDirectory, file.name)));
  }

  if (blobs.length === 0) {
    throw new Error("No unit-test blob reports found.");
  }

  mkdirSync(mergedDirectory, { recursive: true });
  // Use unique filenames because each package writes the same report.json name.
  blobs.forEach((blob, index) => copyFileSync(blob, join(mergedDirectory, `${index}.json`)));
  return blobs.length;
};
