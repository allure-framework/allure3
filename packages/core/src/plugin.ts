import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";

import type { PluginState, ReportFiles } from "@allurereport/plugin-api";

export class DefaultPluginState implements PluginState {
  readonly #state: Record<string, any>;

  constructor(state: Record<string, any>) {
    this.#state = state;
  }

  set = async (key: string, value: any): Promise<void> => {
    this.#state[key] = value;
  };
  get = async <T>(key: string): Promise<T> => {
    return this.#state[key];
  };
  unset = async (key: string): Promise<void> => {
    delete this.#state[key];
  };
}

export class PluginFiles implements ReportFiles {
  readonly #parent: ReportFiles;
  readonly #pluginId: string;

  constructor(
    parent: ReportFiles,
    pluginId: string,
    readonly callback?: (key: string, path: string) => void,
  ) {
    this.#parent = parent;
    this.#pluginId = pluginId;
  }

  addFile = async (key: string, data: Buffer): Promise<string> => {
    const filepath = await this.#parent.addFile(joinPosix(this.#pluginId, key), data);

    this.callback?.(key, filepath);

    return filepath;
  };
}

export class InMemoryReportFiles implements ReportFiles {
  #state: Record<string, Buffer> = {};

  addFile = async (path: string, data: Buffer): Promise<string> => {
    this.#state[path] = data;

    return path;
  };
}

export class FileSystemReportFiles implements ReportFiles {
  readonly #output: string;
  readonly #contentHashToPath = new Map<string, string>();
  readonly #pathToContentHash = new Map<string, string>();

  constructor(output: string) {
    this.#output = resolve(output);
  }

  addFile = async (path: string, data: Buffer): Promise<string> => {
    const targetPath = resolve(this.#output, path);
    const targetDirPath = dirname(targetPath);
    const contentHash = createHash("sha256").update(data).digest("hex");
    const targetPathHash = this.#pathToContentHash.get(targetPath);
    const canonicalPath = this.#contentHashToPath.get(contentHash);

    await mkdir(targetDirPath, { recursive: true });

    if (targetPathHash === contentHash) {
      return targetPath;
    }

    if (canonicalPath && canonicalPath !== targetPath) {
      try {
        await this.#replaceWithHardlink(canonicalPath, targetPath);
        this.#pathToContentHash.set(targetPath, contentHash);
        return targetPath;
      } catch (error) {
        if (!this.#isRecoverableHardlinkError(error)) {
          throw error;
        }
      }
    }

    await this.#replaceWithFile(targetPath, data);
    this.#contentHashToPath.set(contentHash, targetPath);
    this.#pathToContentHash.set(targetPath, contentHash);

    return targetPath;
  };

  #replaceWithFile = async (targetPath: string, data: Buffer): Promise<void> => {
    const tempPath = `${targetPath}.${randomUUID()}.tmp`;

    try {
      await writeFile(tempPath, data, { encoding: "utf-8" });
      await rename(tempPath, targetPath);
    } finally {
      await rm(tempPath, { force: true });
    }
  };

  #replaceWithHardlink = async (canonicalPath: string, targetPath: string): Promise<void> => {
    const tempPath = `${targetPath}.${randomUUID()}.tmp`;

    try {
      await link(canonicalPath, tempPath);
      await rename(tempPath, targetPath);
    } finally {
      await rm(tempPath, { force: true });
    }
  };

  #isRecoverableHardlinkError = (error: unknown): boolean => {
    if (!error || typeof error !== "object" || !("code" in error)) {
      return false;
    }

    return (
      error.code === "EXDEV" ||
      error.code === "EPERM" ||
      error.code === "EEXIST" ||
      error.code === "ENOENT" ||
      error.code === "EACCES"
    );
  };
}
