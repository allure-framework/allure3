import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";

import type { PluginState, ReportFiles } from "@allurereport/plugin-api";

import { OutputOwnership, outputOwnership } from "./outputOwnership.js";

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
    readonly callback?: (key: string, path: string) => void | Promise<void>,
  ) {
    this.#parent = parent;
    this.#pluginId = pluginId;
  }

  addFile = async (key: string, data: Buffer): Promise<string> => {
    const filepath = await this.#parent.addFile(joinPosix(this.#pluginId, key), data);

    await this.callback?.(key, filepath);

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
  readonly #ownership: OutputOwnership;
  readonly #createdDirs = new Map<string, Promise<string | undefined>>();

  constructor(output: string) {
    this.#output = resolve(output);
    this.#ownership = new OutputOwnership(this.#output);
    // Subclasses may override writing, so only the built-in writer advertises ownership tracking.
    if (new.target === FileSystemReportFiles) outputOwnership.set(this, this.#ownership);
  }

  addFile = async (path: string, data: Buffer): Promise<string> => {
    this.#ownership.writeStarted();
    try {
      await this.#ownership.beforeWrite(path);
      const targetPath = this.#ownership.resolve(path);
      const targetDirPath = dirname(targetPath);

      let createdDir = this.#createdDirs.get(targetDirPath);

      if (!createdDir) {
        createdDir = mkdir(targetDirPath, { recursive: true });
        this.#createdDirs.set(targetDirPath, createdDir);
      }

      await createdDir;
      await writeFile(targetPath, data, { encoding: "utf-8" });

      this.#ownership.record(path);
      return targetPath;
    } catch (error) {
      this.#ownership.fail();
      throw error;
    } finally {
      this.#ownership.writeFinished();
    }
  };
}
