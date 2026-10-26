import { randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import { lstat, mkdir, open, readFile, rename, rm, type FileHandle } from "node:fs/promises";
import { isAbsolute, join, posix, relative, sep } from "node:path";

import type { ReportFiles } from "@allurereport/plugin-api";
import { mapConcurrently } from "@allurereport/plugin-api/internal/report";

import { OutputTransaction, transactionDirectory } from "./outputTransaction.js";
import { isFileNotFoundError } from "./utils/misc.js";
import { isPathContainedInDir, resolvePathUnderOutputRoot } from "./utils/safeOutputPath.js";
import { canonicalWindowsName } from "./utils/windows.js";

// This capability registry is internal and is not exported from the package entry point.
export const outputOwnership = new WeakMap<ReportFiles, OutputOwnership>();

const ownershipFile = ".allure-output.json";
const lockFile = ".allure-output.lock";
const reservedFiles = new Set([ownershipFile, lockFile, transactionDirectory]);
type OwnedFile = { path: string; pluginId?: string };
type Inventory = { version: 1; files: OwnedFile[]; layout: Record<string, string>; directories?: string[] };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isRelativePath = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  !value.includes("\\") &&
  !value.includes("\0") &&
  !value.endsWith("/") &&
  !/^[a-z]:/i.test(value) &&
  !posix.isAbsolute(value) &&
  posix.normalize(value) === value &&
  value !== "." &&
  value !== ".." &&
  !value.startsWith("../") &&
  // Reserve internal filenames even under a plugin directory, including Windows aliases.
  !value.split("/").some((part) => reservedFiles.has(canonicalWindowsName(part)));

const parseInventory = (content: string): Inventory => {
  const value: unknown = JSON.parse(content);
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.files) || !isRecord(value.layout)) {
    throw new Error("Invalid Allure output ownership inventory");
  }
  const paths = new Set<string>();
  for (const file of value.files) {
    if (
      !isRecord(file) ||
      !isRelativePath(file.path) ||
      (file.pluginId !== undefined && (typeof file.pluginId !== "string" || file.pluginId.length === 0)) ||
      paths.has(file.path)
    ) {
      throw new Error("Invalid file in Allure output ownership inventory");
    }
    paths.add(file.path);
  }
  if (!Object.entries(value.layout).every(([id, path]) => id.length > 0 && (path === "" || isRelativePath(path)))) {
    throw new Error("Invalid layout in Allure output ownership inventory");
  }
  if (
    value.directories !== undefined &&
    (!Array.isArray(value.directories) || !value.directories.every(isRelativePath))
  ) {
    throw new Error("Invalid directories in Allure output ownership inventory");
  }
  return value as Inventory;
};

// Internal to the built-in filesystem writer. Direct writes retain an inventory;
// replacement of a completed owned report uses a separate finalization transaction.
export class OutputOwnership {
  // A running session may still skip inventory publication when existing metadata is incompatible.
  #enabled = false;
  #active = false;
  #failed = false;
  #abort = false;
  #previous: OwnedFile[] = [];
  #previousContent?: string;
  #lock?: FileHandle;
  #initialization?: Promise<void>;
  #pendingWrites = 0;
  #writesSettled: Promise<void> = Promise.resolve();
  #resolveWrites?: () => void;
  #transaction?: OutputTransaction;
  #directories = new Set<string>();
  readonly #currentFiles = new Map<string, OwnedFile>();

  constructor(readonly output: string) {}

  get aborted() {
    return this.#transaction !== undefined && this.#abort;
  }

  get pendingReplacement() {
    return this.#transaction !== undefined && !this.#transaction.committed;
  }

  get directory() {
    return this.#transaction?.stage ?? this.output;
  }

  async stage() {
    await this.acquire();
    // There is no ownership contract to replace on a fresh or legacy output.
    // Keep first-generation paths and streaming/publication behavior unchanged.
    if (!this.#active || this.#previousContent === undefined) return;
    await this.#writesSettled;
    for (const path of this.#currentFiles.keys()) this.#rememberDirectories(path);
    this.#transaction = await OutputTransaction.create(
      this.output,
      [...new Set([...this.#previous.map((file) => file.path), ...this.#currentFiles.keys()])],
      [...this.#currentFiles.keys()],
    );
  }

  async preflight(flattenedPlugin?: string) {
    if (!this.#transaction || this.#abort) return;
    const currentFiles = await this.#existingFiles();
    if (currentFiles.length !== this.#currentFiles.size) throw new Error("Missing staged report files");
    const files = currentFiles.map(({ path }) =>
      flattenedPlugin && path.startsWith(`${flattenedPlugin}/`) ? path.slice(flattenedPlugin.length + 1) : path,
    );
    await this.#transaction.preflight(files, !this.#failed && this.#active);
  }

  ownsDirectory(path: string) {
    return this.#transaction !== undefined && (path === transactionDirectory || this.#directories.has(path));
  }

  // Non-fatal publication/bookkeeping errors keep local fallback, but suppress retirement.
  fail(abort = true) {
    this.#failed = true;
    this.#abort ||= abort;
  }

  writeStarted() {
    if (this.#pendingWrites++ === 0) {
      this.#writesSettled = new Promise((resolve) => {
        this.#resolveWrites = resolve;
      });
    }
  }

  writeFinished() {
    if (--this.#pendingWrites === 0) this.#resolveWrites?.();
  }

  async stop() {
    this.#enabled = false;
    this.#active = false;
    // Acquisition reports its error to the caller; cleanup must still close any opened handle.
    try {
      await this.#initialization;
    } catch {}
    await this.#writesSettled;
    this.#initialization = undefined;
    await this.#transaction?.dispose();
    this.#transaction = undefined;
    const lock = this.#lock;
    this.#lock = undefined;
    if (!lock) return;
    const target = join(this.output, lockFile);
    try {
      let owned = false;
      try {
        const original = await lock.stat();
        const current = await lstat(target);
        owned = original.ino !== 0 && original.dev === current.dev && original.ino === current.ino;
        if (original.ino === 0) console.warn(`Cannot verify report lock identity; preserving ${target}`);
      } catch (error) {
        if (!isFileNotFoundError(error)) throw error;
      } finally {
        await lock.close();
      }
      // A replaced or unidentifiable lock is not ours to remove.
      if (owned) await rm(target);
    } catch (error) {
      console.warn(`Could not release report output lock ${target}`, error);
    }
  }

  async #checkForSymlinks(path: string, root = this.directory) {
    // The output root itself may be a deployment symlink; only paths beneath it are checked.
    let current = root;
    let stats: Stats | undefined;
    for (const part of path.split("/")) {
      current = join(current, part);
      try {
        stats = await lstat(current);
        if (stats.isSymbolicLink()) throw new Error(`Symbolic link in report output: ${current}`);
      } catch (error) {
        if (!isFileNotFoundError(error)) throw error;
        return undefined;
      }
    }
    return stats;
  }

  begin() {
    if (this.#enabled || this.#lock || this.#initialization || this.#pendingWrites > 0) {
      throw new Error(`Report output is locked: ${join(this.output, lockFile)}`);
    }
    this.#directories.clear();
    this.#previous = [];
    this.#previousContent = undefined;
    this.#currentFiles.clear();
    this.#failed = false;
    this.#abort = false;
    this.#enabled = true;
  }

  async acquire() {
    if (!this.#enabled) return;
    this.#initialization ??= this.#acquireLock();
    await this.#initialization;
  }

  async #acquireLock() {
    await mkdir(this.output, { recursive: true });
    const target = join(this.output, lockFile);
    try {
      this.#lock = await open(target, "wx");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new Error(
          `Report output is locked: ${target}. Another generation may be running; remove a stale lock only after its owner has stopped.`,
          { cause: error },
        );
      }
      throw error;
    }
    await this.#lock.writeFile(JSON.stringify({ pid: process.pid }));
    await OutputTransaction.checkRecovery(this.output);
    let content: string | undefined;
    try {
      await this.#checkForSymlinks(ownershipFile);
      content = await readFile(join(this.output, ownershipFile), "utf8");
    } catch (error) {
      if (!isFileNotFoundError(error)) return;
    }
    if (content !== undefined) {
      // An optional inventory must not prevent generation or overwrite an unrelated file.
      try {
        const inventory = parseInventory(content);
        await mapConcurrently(inventory.files, async (file) => this.#checkForSymlinks(file.path), 64);
        this.#previous = inventory.files;
        for (const path of inventory.directories ?? []) this.#directories.add(path);
        for (const file of inventory.files) this.#rememberDirectories(file.path);
        this.#previousContent = content;
      } catch {
        return;
      }
    }
    this.#active = this.#enabled;
  }

  async beforeWrite(path: string, file = true) {
    if (!this.#enabled) return;
    await this.acquire();
    const normalized = this.#relativePath(path);
    if (
      normalized.split("/").some((part) => {
        const name = canonicalWindowsName(part);
        return name === lockFile || name === transactionDirectory;
      })
    ) {
      throw new Error(`Reserved report output path: ${path}`);
    }
    // Preserve legacy plugin filenames; an inventory cannot represent reserved or noncanonical paths.
    if (!isRelativePath(normalized)) this.#active = false;
    if (this.#transaction && file) {
      const target = await this.#checkForSymlinks(normalized, this.output);
      if (target && !target.isFile()) throw new Error(`Not a report file: ${normalized}`);
    }
    await this.#checkForSymlinks(normalized);
  }

  #relativePath(path: string) {
    const root = isAbsolute(path) && !isPathContainedInDir(this.directory, path) ? this.output : this.directory;
    return relative(root, resolvePathUnderOutputRoot(root, path)).split(sep).join("/");
  }

  resolve(path: string) {
    return resolvePathUnderOutputRoot(this.directory, this.#relativePath(path));
  }

  record(path: string, pluginId?: string) {
    if (!this.#active && !this.#transaction) return;
    const normalized = this.#relativePath(path);
    this.#currentFiles.set(normalized, { path: normalized, pluginId });
  }

  relocate(from: string, to: string) {
    if (!this.#active && !this.#transaction) return;
    const source = this.#relativePath(from);
    const destination = this.#relativePath(to);
    const remap = (file: OwnedFile): OwnedFile =>
      file.path === source || file.path.startsWith(`${source}/`)
        ? { ...file, path: `${destination}${file.path.slice(source.length)}` }
        : file;
    // A transaction already captured previous physical paths; only direct sessions merge them later.
    if (!this.#transaction) this.#previous = this.#previous.map(remap);
    const files = [...this.#currentFiles.values()].map(remap);
    this.#currentFiles.clear();
    for (const file of files) this.#currentFiles.set(file.path, file);
  }

  async finish(flattenedPlugin?: string) {
    await this.acquire();
    await this.#writesSettled;
    if (this.#failed || !this.#active) {
      if (this.#transaction && !this.#abort)
        await this.#transaction.commit((await this.#existingFiles()).map((file) => file.path));
      return;
    }
    this.#active = false;
    // Core releases the lock in finally, including when publication or finalization fails.
    await this.#publish(flattenedPlugin);
  }

  #rememberDirectories(path: string) {
    const parts = path.split("/");
    for (let index = 1; index < parts.length; index++) this.#directories.add(parts.slice(0, index).join("/"));
  }

  async #existingFiles() {
    const files = await mapConcurrently(
      [...this.#currentFiles.values()],
      async (file) => {
        const stats = await this.#checkForSymlinks(file.path);
        if (!stats) return undefined;
        if (!stats.isFile()) throw new Error(`Not a report file: ${file.path}`);
        return file;
      },
      64,
    );
    return files.filter((file): file is OwnedFile => file !== undefined);
  }

  async #publish(flattenedPlugin?: string) {
    // Only transactional finalization can retire earlier ownership. Direct writer sessions retain the union.
    const files = new Map(this.#transaction ? [] : this.#previous.map((file) => [file.path, file] as const));
    const layout: Record<string, string> = Object.create(null);
    const currentFiles = await this.#existingFiles();
    for (const file of currentFiles) {
      files.set(file.path, file);
      this.#rememberDirectories(file.path);
      if (file.pluginId !== undefined) layout[file.pluginId] = file.pluginId === flattenedPlugin ? "" : file.pluginId;
    }
    const inventory: Inventory = {
      version: 1,
      files: [...files.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
      layout,
      ...(this.#transaction ? { directories: [...this.#directories].sort() } : {}),
    };
    const target = join(this.output, ownershipFile);
    let currentContent: string | undefined;
    try {
      await this.#checkForSymlinks(ownershipFile, this.output);
      currentContent = await readFile(target, "utf8");
    } catch (error) {
      if (!isFileNotFoundError(error)) return;
    }
    if (currentContent !== this.#previousContent) {
      if (this.#transaction) throw new Error("Report ownership changed before replacement");
      return;
    }
    if (this.#transaction) {
      await this.#transaction.commit([...files.keys()], JSON.stringify(inventory));
      return;
    }
    const temporary = join(this.output, `${ownershipFile}.${randomUUID()}.tmp`);
    // Open outside the cleanup block: if exclusive creation fails, the existing file is not ours to remove.
    const handle = await open(temporary, "wx");
    try {
      try {
        await handle.writeFile(JSON.stringify(inventory));
      } finally {
        await handle.close();
      }
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
