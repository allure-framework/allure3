import { randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import { lstat, mkdir, open, readFile, rename, rm, type FileHandle } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";

import type { ReportFiles } from "@allurereport/plugin-api";
import { mapConcurrently } from "@allurereport/plugin-api/internal/report";

import { isFileNotFoundError } from "./utils/misc.js";
import { resolvePathUnderOutputRoot } from "./utils/safeOutputPath.js";

// This capability registry is internal and is not exported from the package entry point.
export const outputOwnership = new WeakMap<ReportFiles, OutputOwnership>();

const ownershipFile = ".allure-output.json";
const lockFile = ".allure-output.lock";
const reservedFiles = new Set([ownershipFile, lockFile]);
type OwnedFile = { path: string; pluginId?: string };
type Inventory = { version: 1; files: OwnedFile[]; layout: Record<string, string> };
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
  !value.split("/").some((part) => reservedFiles.has(part.replace(/[. ]+$/, "").toLowerCase()));

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
  return value as Inventory;
};

// Internal to the built-in filesystem writer. This is an inventory, not a transaction:
// it neither removes obsolete files nor rolls back writes made by report generation.
export class OutputOwnership {
  // A running session may still skip inventory publication when existing metadata is incompatible.
  #enabled = false;
  #active = false;
  #failed = false;
  #previous: OwnedFile[] = [];
  #previousContent?: string;
  #lock?: FileHandle;
  #initialization?: Promise<void>;
  #pendingWrites = 0;
  #writesSettled: Promise<void> = Promise.resolve();
  #resolveWrites?: () => void;
  readonly #currentFiles = new Map<string, OwnedFile>();

  constructor(readonly output: string) {}

  fail() {
    this.#failed = true;
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
    const lock = this.#lock;
    this.#lock = undefined;
    if (!lock) return;
    const target = join(this.output, lockFile);
    let owned = false;
    try {
      const original = await lock.stat();
      const current = await lstat(target);
      owned = original.dev === current.dev && original.ino === current.ino;
    } catch (error) {
      if (!isFileNotFoundError(error)) throw error;
    } finally {
      await lock.close();
    }
    // A replaced lock is not ours to remove.
    if (owned) await rm(target);
  }

  async #checkForSymlinks(path: string) {
    // The output root itself may be a deployment symlink; only paths beneath it are checked.
    let current = this.output;
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
    this.#previous = [];
    this.#previousContent = undefined;
    this.#currentFiles.clear();
    this.#failed = false;
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
        this.#previousContent = content;
      } catch {
        return;
      }
    }
    this.#active = this.#enabled;
  }

  async beforeWrite(path: string) {
    if (!this.#enabled) return;
    await this.acquire();
    const normalized = this.#relativePath(path);
    if (normalized.split("/").some((part) => part.replace(/[. ]+$/, "").toLowerCase() === lockFile)) {
      throw new Error(`Reserved report output lock path: ${path}`);
    }
    // Preserve legacy plugin filenames; an inventory cannot represent reserved or noncanonical paths.
    if (!isRelativePath(normalized)) this.#active = false;
    await this.#checkForSymlinks(normalized);
  }

  #relativePath(path: string) {
    return relative(this.output, resolvePathUnderOutputRoot(this.output, path)).split(sep).join("/");
  }

  record(path: string, pluginId?: string) {
    if (!this.#active) return;
    const normalized = this.#relativePath(path);
    this.#currentFiles.set(normalized, { path: normalized, pluginId });
  }

  relocate(from: string, to: string) {
    if (!this.#active) return;
    const source = this.#relativePath(from);
    const destination = this.#relativePath(to);
    const remap = (file: OwnedFile): OwnedFile =>
      file.path === source || file.path.startsWith(`${source}/`)
        ? { ...file, path: `${destination}${file.path.slice(source.length)}` }
        : file;
    this.#previous = this.#previous.map(remap);
    const files = [...this.#currentFiles.values()].map(remap);
    this.#currentFiles.clear();
    for (const file of files) this.#currentFiles.set(file.path, file);
  }

  async finish(flattenedPlugin?: string) {
    await this.acquire();
    await this.#writesSettled;
    if (!this.#active || this.#failed) return;
    this.#active = false;
    // Core releases the lock in finally, including when publication or finalization fails.
    await this.#publish(flattenedPlugin);
  }

  async #publish(flattenedPlugin?: string) {
    // Preserve earlier ownership until transactional cleanup can retire obsolete files safely.
    const files = new Map(this.#previous.map((file) => [file.path, file]));
    const layout: Record<string, string> = Object.create(null);
    const currentFiles = await mapConcurrently(
      [...this.#currentFiles.values()],
      async (file) => {
        const stats = await this.#checkForSymlinks(file.path);
        if (!stats) return undefined;
        if (!stats.isFile()) throw new Error(`Not a report file: ${file.path}`);
        return file;
      },
      64,
    );
    for (const file of currentFiles) {
      if (!file) continue;
      files.set(file.path, file);
      if (file.pluginId !== undefined) layout[file.pluginId] = file.pluginId === flattenedPlugin ? "" : file.pluginId;
    }
    const inventory: Inventory = {
      version: 1,
      files: [...files.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
      layout,
    };
    const target = join(this.output, ownershipFile);
    let currentContent: string | undefined;
    try {
      await this.#checkForSymlinks(ownershipFile);
      currentContent = await readFile(target, "utf8");
    } catch (error) {
      if (!isFileNotFoundError(error)) return;
    }
    if (currentContent !== this.#previousContent) return;
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
