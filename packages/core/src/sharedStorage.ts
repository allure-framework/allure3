import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";

import type { ReportFiles } from "@allurereport/plugin-api";

import { resolvePathUnderOutputRoot } from "./utils/safeOutputPath.js";

const SHARED_DIR = "_shared";

export class SharedReportFiles implements ReportFiles {
  readonly #output: string;
  readonly #written = new Map<string, Promise<string>>();
  readonly #createdDirs = new Map<string, Promise<string | undefined>>();

  constructor(output: string) {
    this.#output = resolve(output);
  }

  addFile = async (path: string, data: Buffer): Promise<string> => {
    if (!this.#written.has(path)) {
      this.#written.set(path, this.#writeFile(path, data));
    }

    return this.#written.get(path)!;
  };

  #writeFile = async (path: string, data: Buffer): Promise<string> => {
    const relativePath = joinPosix(SHARED_DIR, path);
    const targetPath = resolvePathUnderOutputRoot(this.#output, relativePath);
    const targetDirPath = dirname(targetPath);

    let createdDir = this.#createdDirs.get(targetDirPath);

    if (!createdDir) {
      createdDir = mkdir(targetDirPath, { recursive: true });
      this.#createdDirs.set(targetDirPath, createdDir);
    }

    await createdDir;
    await writeFile(targetPath, data, { encoding: "utf-8" });

    return targetPath;
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
      this.#written.set(fileName, this.#writeFile(fileName, data));
    }

    return this.#written.get(fileName)!;
  };

  #writeFile = async (key: string, data: Buffer): Promise<string> => {
    const relativePath = joinPosix(SHARED_DIR, key);
    const targetPath = resolvePathUnderOutputRoot(this.#output, relativePath);
    const targetDirPath = dirname(targetPath);

    let createdDir = this.#createdDirs.get(targetDirPath);

    if (!createdDir) {
      createdDir = mkdir(targetDirPath, { recursive: true });
      this.#createdDirs.set(targetDirPath, createdDir);
    }

    await createdDir;
    await writeFile(targetPath, data, { encoding: "utf-8" });

    return targetPath;
  };
}
