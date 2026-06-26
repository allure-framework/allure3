import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
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
    const hash = createHash("sha256").update(data).digest("hex");
    const ext = extname(path);
    const casKey = `${hash}${ext}`;

    if (!this.#written.has(casKey)) {
      this.#written.set(casKey, this.#writeFile(casKey, data));
    }

    return this.#written.get(casKey)!;
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

  static sharedAttachmentsBasePath(_pluginId: string): string {
    return joinPosix("..", SHARED_DIR);
  }
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
