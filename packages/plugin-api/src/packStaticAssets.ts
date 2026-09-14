import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";

import { pack } from "tar-stream";

type StaticFile = {
  absolutePath: string;
  archivePath: string;
};

const collectFiles = async (sourceDir: string, currentDir = sourceDir): Promise<StaticFile[]> => {
  const files: StaticFile[] = [];

  for (const entry of await readdir(currentDir, { withFileTypes: true })) {
    const absolutePath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(sourceDir, absolutePath)));
      continue;
    }

    if (!entry.isFile()) {
      throw new Error(`Unsupported report static file: ${absolutePath}`);
    }

    files.push({
      absolutePath,
      archivePath: relative(sourceDir, absolutePath).split(sep).join(posix.sep),
    });
  }

  return files.sort((left, right) => {
    if (left.archivePath < right.archivePath) {
      return -1;
    }

    if (left.archivePath > right.archivePath) {
      return 1;
    }

    return 0;
  });
};

const validateInlineableBuild = async (files: StaticFile[]) => {
  const filesByName = new Map(files.map((file) => [file.archivePath, file]));
  const manifestFile = filesByName.get("manifest.json");

  if (!manifestFile) {
    throw new Error("The report static build does not contain manifest.json");
  }

  const manifest = JSON.parse(await readFile(manifestFile.absolutePath, "utf8")) as Record<string, unknown>;
  const allowedKeys = new Set(["main.js", "main.css"]);

  if (typeof manifest["main.js"] !== "string") {
    throw new Error('The report static build manifest does not contain "main.js"');
  }

  for (const [key, value] of Object.entries(manifest)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`The report static build is not single-file compatible; unexpected manifest entry: ${key}`);
    }

    if (typeof value !== "string" || !filesByName.has(value)) {
      throw new Error(`The report static build does not contain manifest asset: ${String(value)}`);
    }
  }

  const manifestAssets = new Set(Object.values(manifest));

  for (const file of files) {
    if (
      file.archivePath !== "manifest.json" &&
      !manifestAssets.has(file.archivePath) &&
      !file.archivePath.endsWith(".LICENSE.txt")
    ) {
      throw new Error(`The report static build is not single-file compatible; unexpected asset: ${file.archivePath}`);
    }
  }
};

export const createReportStaticArchive = async (source: string, target: string): Promise<void> => {
  const sourceDir = resolve(source);
  const targetPath = resolve(target);
  const temporaryPath = `${targetPath}.tmp`;
  const sourceStats = await stat(sourceDir);

  if (!sourceStats.isDirectory()) {
    throw new Error(`The report static source is not a directory: ${sourceDir}`);
  }

  const files = await collectFiles(sourceDir);

  await validateInlineableBuild(files);
  await mkdir(dirname(targetPath), { recursive: true });
  await rm(temporaryPath, { force: true });

  const archive = pack();
  const output = pipeline(archive, createWriteStream(temporaryPath));

  try {
    for (const file of files) {
      const content = await readFile(file.absolutePath);

      await new Promise<void>((resolveEntry, rejectEntry) => {
        archive.entry(
          {
            name: file.archivePath,
            size: content.length,
            mode: 0o644,
            mtime: new Date(0),
            uid: 0,
            gid: 0,
          },
          content,
          (error) => (error ? rejectEntry(error) : resolveEntry()),
        );
      });
    }

    archive.finalize();
    await output;
    await rename(temporaryPath, targetPath);
  } catch (error) {
    archive.destroy();

    try {
      await output;
    } catch {
      // Preserve the original packing error after the output stream has closed.
    }

    await rm(temporaryPath, { force: true });
    throw error;
  }
};
