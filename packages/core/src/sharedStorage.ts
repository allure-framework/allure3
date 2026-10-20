import { createHash } from "node:crypto";
import { link, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";

import { type ReportFiles, SHARED_DIR } from "@allurereport/plugin-api";

import { resolvePathUnderOutputRoot } from "./utils/safeOutputPath.js";

type SharedFile = {
  path: string;
  contentHash: string;
};

export class SharedReportFiles implements ReportFiles {
  readonly #output: string;
  readonly #writtenByKey = new Map<string, Promise<SharedFile>>();
  readonly #writtenByContentHash = new Map<string, Promise<SharedFile>>();
  readonly #createdDirs = new Map<string, Promise<string | undefined>>();

  constructor(output: string) {
    this.#output = resolve(output);
  }

  addFile = async (key: string, data: Buffer): Promise<string> => {
    const contentHash = createHash("sha256").update(data).digest("hex");
    const alreadyWritten = this.#writtenByKey.get(key);

    if (alreadyWritten) {
      const existing = await alreadyWritten;

      if (existing.contentHash !== contentHash) {
        throw new Error(
          `Two different contents are written to the same shared report file: ${joinPosix(SHARED_DIR, key)}`,
        );
      }

      return existing.path;
    }

    const sameContent = this.#writtenByContentHash.get(contentHash);
    const written = this.#write(key, data, contentHash, sameContent);

    this.#writtenByKey.set(key, written);

    if (!sameContent) {
      this.#writtenByContentHash.set(contentHash, written);
    }

    return (await written).path;
  };

  #write = async (
    key: string,
    data: Buffer,
    contentHash: string,
    sameContent: Promise<SharedFile> | undefined,
  ): Promise<SharedFile> => {
    const targetPath = resolvePathUnderOutputRoot(this.#output, joinPosix(SHARED_DIR, key));

    await this.#createDir(dirname(targetPath));

    if (sameContent) {
      const { path: existingPath } = await sameContent;

      try {
        await link(existingPath, targetPath);

        return { path: targetPath, contentHash };
      } catch {}
    }

    await writeFile(targetPath, data);

    return { path: targetPath, contentHash };
  };

  #createDir = async (dirPath: string): Promise<void> => {
    let createdDir = this.#createdDirs.get(dirPath);

    if (!createdDir) {
      createdDir = mkdir(dirPath, { recursive: true });
      this.#createdDirs.set(dirPath, createdDir);
    }

    await createdDir;
  };
}
