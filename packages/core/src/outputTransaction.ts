import { randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { mapConcurrently } from "@allurereport/plugin-api/internal/report";

import { isFileNotFoundError } from "./utils/misc.js";
import { isPathContainedInDir, resolvePathUnderOutputRoot } from "./utils/safeOutputPath.js";
import { canonicalWindowsName } from "./utils/windows.js";

export const transactionDirectory = ".allure-output-transaction";
const samePath = (left: string, right: string) =>
  isPathContainedInDir(left, right) && isPathContainedInDir(right, left);
const journalTemporary = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.tmp$/;

type Journal = {
  version: 1;
  output: string;
  stage: string;
  status: "staging" | "installing" | "committed" | "rolled-back";
  previous: string[];
  next: string[];
};

// Only native finalization uses this capability. Streaming writes and custom writers retain their paths.
export class OutputTransaction {
  readonly #installed: string[] = [];
  readonly #backedUp: string[] = [];
  readonly #createdDirectories: string[] = [];
  #retain = false;
  #started = false;
  committed = false;

  private constructor(
    readonly output: string,
    readonly stage: string,
    readonly previous: readonly string[],
  ) {}

  static async checkRecovery(output: string) {
    const backup = join(output, transactionDirectory);
    let exists = false;
    try {
      const stats = await lstat(backup);
      exists = true;
      if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error("Invalid recovery directory");
      const journal: unknown = JSON.parse(await readFile(join(backup, "journal.json"), "utf8"));
      if (
        !journal ||
        typeof journal !== "object" ||
        !("version" in journal) ||
        journal.version !== 1 ||
        !("output" in journal) ||
        typeof journal.output !== "string" ||
        !samePath(journal.output, output) ||
        !("stage" in journal) ||
        typeof journal.stage !== "string" ||
        !samePath(journal.stage, join(backup, "stage")) ||
        !("previous" in journal) ||
        !Array.isArray(journal.previous) ||
        !journal.previous.every((path) => typeof path === "string") ||
        !("next" in journal) ||
        !Array.isArray(journal.next) ||
        !journal.next.every((path) => typeof path === "string") ||
        !("status" in journal) ||
        (journal.status !== "staging" && journal.status !== "committed" && journal.status !== "rolled-back")
      )
        throw new Error("Unfinished output replacement");
      if (journal.status === "staging") {
        const entries = await readdir(backup, { withFileTypes: true });
        if (
          !entries.every((entry) =>
            entry.name === "stage"
              ? entry.isDirectory()
              : entry.isFile() && (entry.name === "journal.json" || journalTemporary.test(entry.name)),
          )
        ) {
          throw new Error("Unexpected files in interrupted staging");
        }
      }
      // Staging has not touched visible files; terminal journals are also safe to discard.
      await rm(backup, { recursive: true });
    } catch (error) {
      if (isFileNotFoundError(error)) {
        if (!exists) return;
        const entries = await readdir(backup, { withFileTypes: true });
        // The first journal is persisted before any file moves. Only our temporary journal files may exist.
        if (entries.every((entry) => entry.isFile() && journalTemporary.test(entry.name))) {
          await rm(backup, { recursive: true });
          return;
        }
      }
      throw new Error(`Report output needs recovery. Preserve and inspect ${backup} before generating again.`, {
        cause: error,
      });
    }
  }

  static async create(output: string, previous: readonly string[], current: readonly string[]) {
    const backup = join(output, transactionDirectory);
    await mkdir(backup);
    const stage = join(backup, "stage");
    const transaction = new OutputTransaction(output, stage, previous);
    try {
      await transaction.#saveJournal("staging", []);
      await mkdir(stage);
      for (const path of current) {
        const source = resolvePathUnderOutputRoot(output, path);
        const target = resolvePathUnderOutputRoot(stage, path);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(source, target);
      }
      return transaction;
    } catch (error) {
      await transaction.dispose();
      throw error;
    }
  }

  async #checkTarget(path: string) {
    const target = resolvePathUnderOutputRoot(this.output, path);
    let current = this.output;
    for (const part of relative(this.output, target).split(/[\\/]/)) {
      current = join(current, part);
      try {
        const stats = await lstat(current);
        if (stats.isSymbolicLink() || (current === target ? !stats.isFile() : !stats.isDirectory())) {
          throw new Error(`Unsafe report replacement target: ${current}`);
        }
      } catch (error) {
        if (isFileNotFoundError(error)) return;
        throw error;
      }
    }
  }

  async preflight(next: readonly string[], retire = true) {
    const paths = new Set(next);
    for (const path of paths) {
      if (isAbsolute(path) || path.split("/").some((part) => canonicalWindowsName(part) === transactionDirectory)) {
        throw new Error(`Invalid report replacement path: ${path}`);
      }
      resolvePathUnderOutputRoot(this.output, path);
      let parent = dirname(path);
      while (parent !== ".") {
        if (paths.has(parent)) throw new Error(`Report file is also a parent directory: ${parent}`);
        parent = dirname(parent);
      }
    }
    await mapConcurrently(
      [...new Set([...(retire ? this.previous : []), ...next, ".allure-output.json"])],
      async (path) => this.#checkTarget(path),
      64,
    );
  }

  async #ensureParent(target: string) {
    const missing: string[] = [];
    let directory = dirname(target);
    while (directory !== this.output) {
      try {
        await lstat(directory);
        break;
      } catch (error) {
        if (!isFileNotFoundError(error)) throw error;
        missing.push(directory);
        directory = dirname(directory);
      }
    }
    for (const path of missing.reverse()) {
      await mkdir(path);
      this.#createdDirectories.push(path);
    }
  }

  async commit(next: readonly string[], inventory?: string) {
    if (this.#started) throw new Error("Report output replacement has already started");
    this.#started = true;
    await this.preflight(next, inventory !== undefined);
    const backup = join(this.output, transactionDirectory);
    try {
      await this.#saveJournal("installing", next);
      await mkdir(join(backup, "files"));
      const affected = new Set(inventory === undefined ? [] : this.previous);
      for (const path of next) affected.add(path);
      if (inventory !== undefined) affected.add(".allure-output.json");
      for (const path of affected) {
        const target = resolvePathUnderOutputRoot(this.output, path);
        const saved = resolvePathUnderOutputRoot(join(backup, "files"), path);
        try {
          await lstat(target);
        } catch (error) {
          if (isFileNotFoundError(error)) continue;
          throw error;
        }
        await mkdir(dirname(saved), { recursive: true });
        await rename(target, saved);
        this.#backedUp.push(path);
      }
      const ordered = [...next].sort((a, b) => Number(/\.html?$/i.test(a)) - Number(/\.html?$/i.test(b)));
      for (const path of ordered) {
        const target = resolvePathUnderOutputRoot(this.output, path);
        await this.#ensureParent(target);
        await rename(resolvePathUnderOutputRoot(this.stage, path), target);
        this.#installed.push(path);
      }
      if (inventory !== undefined) {
        await writeFile(join(this.stage, ".allure-output.json"), inventory, { flag: "wx" });
        await rename(join(this.stage, ".allure-output.json"), join(this.output, ".allure-output.json"));
        this.#installed.push(".allure-output.json");
      }
      await this.#saveJournal("committed", next);
      this.committed = true;
    } catch (error) {
      const errors: unknown[] = [error];
      for (const path of [...this.#installed].reverse()) {
        try {
          await rm(resolvePathUnderOutputRoot(this.output, path));
        } catch (failure) {
          errors.push(failure);
        }
      }
      for (const path of [...this.#backedUp].reverse()) {
        try {
          await rename(
            resolvePathUnderOutputRoot(join(backup, "files"), path),
            resolvePathUnderOutputRoot(this.output, path),
          );
        } catch (failure) {
          errors.push(failure);
        }
      }
      for (const path of [...this.#createdDirectories].reverse()) {
        try {
          await rmdir(path);
        } catch (failure) {
          errors.push(failure);
        }
      }
      if (errors.length > 1) {
        this.#retain = true;
        throw new AggregateError(errors, `Report replacement and rollback failed. Recovery data: ${backup}`, {
          cause: error,
        });
      }
      try {
        await this.#saveJournal("rolled-back", next);
      } catch (failure) {
        this.#retain = true;
        throw new AggregateError([error, failure], `Could not record rollback. Recovery data: ${backup}`, {
          cause: error,
        });
      }
      await this.#cleanup(backup);
      throw error;
    }
    // A cleanup failure does not turn a completed report into a failed generation.
    await this.#cleanup(backup);
    const directories = new Set<string>();
    for (const path of this.previous) {
      for (let parent = dirname(path); parent !== "."; parent = dirname(parent)) directories.add(parent);
    }
    for (const path of [...directories].sort((a, b) => b.length - a.length)) {
      try {
        await rmdir(join(this.output, path));
      } catch (error) {
        if (!isFileNotFoundError(error) && !(error instanceof Error && "code" in error && error.code === "ENOTEMPTY")) {
          console.warn(`Could not remove empty report directory ${path}`, error);
        }
      }
    }
  }

  async #saveJournal(status: Journal["status"], next: readonly string[]) {
    const backup = join(this.output, transactionDirectory);
    const journal: Journal = {
      version: 1,
      output: resolve(this.output),
      stage: this.stage,
      status,
      previous: [...this.previous],
      next: [...next],
    };
    const temporary = join(backup, `${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(journal), { flag: "wx" });
    await rename(temporary, join(backup, "journal.json"));
  }

  async #cleanup(path: string) {
    try {
      await rm(path, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Could not clean report recovery files at ${path}`, error);
    }
  }

  async dispose() {
    if (!this.#retain) await this.#cleanup(join(this.output, transactionDirectory));
  }
}
