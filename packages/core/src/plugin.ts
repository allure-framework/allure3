import type { PluginState, ReportFiles } from "@allurereport/plugin-api";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { join as joinPosix } from "node:path/posix";

export class DefaultPluginState implements PluginState {
  readonly #state: Record<string, any>;

  constructor(state: Record<string, any>) {
    this.#state = state;
  }

  set = async (key: string, value: any): Promise<void> => {
    this.#state[key] = value;
  };
  get = async (key: string): Promise<void> => {
    return this.#state[key];
  };
  unset = async (key: string): Promise<void> => {
    delete this.#state[key];
  };
}

export class PluginFiles implements ReportFiles {
  readonly #parent: ReportFiles;
  readonly #pluginId: string;

  constructor(parent: ReportFiles, pluginId: string) {
    this.#parent = parent;
    this.#pluginId = pluginId;
  }

  addFile = async (key: string, data: Buffer): Promise<void> => {
    await this.#parent.addFile(joinPosix(this.#pluginId, key), data);
  };
}

export class InMemoryReportFiles implements ReportFiles {
  #state: Record<string, Buffer> = {};

  addFile = async (path: string, data: Buffer): Promise<void> => {
    this.#state[path] = data;
  };
}

export class FileSystemReportFiles implements ReportFiles {
  readonly #output: string;

  constructor(output: string) {
    this.#output = resolve(output);
  }

  addFile = async (path: string, data: Buffer): Promise<void> => {
    const targetPath = resolve(this.#output, path);
    const targetDirPath = dirname(targetPath);

    await mkdir(targetDirPath, { recursive: true });
    await writeFile(targetPath, data, { encoding: "utf-8" });
  };
}
