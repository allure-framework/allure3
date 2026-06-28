import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";

import type { ReportFiles } from "@allurereport/plugin-api";

import { resolvePathUnderOutputRoot } from "./utils/safeOutputPath.js";

const SHARED_DIR = "_shared";

const writeSharedFile = async (
  output: string,
  createdDirs: Map<string, Promise<string | undefined>>,
  key: string,
  data: Buffer,
): Promise<string> => {
  const relativePath = joinPosix(SHARED_DIR, key);
  const targetPath = resolvePathUnderOutputRoot(output, relativePath);
  const targetDirPath = dirname(targetPath);

  let createdDir = createdDirs.get(targetDirPath);

  if (!createdDir) {
    createdDir = mkdir(targetDirPath, { recursive: true });
    createdDirs.set(targetDirPath, createdDir);
  }

  await createdDir;
  await writeFile(targetPath, data);

  return targetPath;
};

export class SharedReportFiles implements ReportFiles {
  readonly #output: string;
  readonly #written = new Map<string, Promise<string>>();
  readonly #createdDirs = new Map<string, Promise<string | undefined>>();

  constructor(output: string) {
    this.#output = resolve(output);
  }

  addFile = async (path: string, data: Buffer): Promise<string> => {
    if (!this.#written.has(path)) {
      this.#written.set(path, writeSharedFile(this.#output, this.#createdDirs, path, data));
    }

    return this.#written.get(path)!;
  };
}

export class SharedAssetsReportFiles implements ReportFiles {
  readonly #output: string;
  readonly #written = new Map<string, Promise<string>>();
  readonly #createdDirs = new Map<string, Promise<string | undefined>>();

  constructor(output: string) {
    this.#output = resolve(output);
  }

  addFile = async (path: string, data: Buffer): Promise<string> => {
    const fileName = basename(path);

    if (!this.#written.has(fileName)) {
      this.#written.set(fileName, writeSharedFile(this.#output, this.#createdDirs, fileName, data));
    }

    return this.#written.get(fileName)!;
  };
}
