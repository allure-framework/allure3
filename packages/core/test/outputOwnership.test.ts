import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { feature, story } from "allure-js-commons";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { outputOwnership } from "../src/outputOwnership.js";
import type { OutputOwnership } from "../src/outputOwnership.js";
import { FileSystemReportFiles } from "../src/plugin.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename), writeFile: vi.fn(actual.writeFile), open: vi.fn(actual.open) };
});

let output: string;
const owners: OutputOwnership[] = [];
const createWriter = () => {
  const writer = new FileSystemReportFiles(output);
  const ownership = outputOwnership.get(writer)!;
  owners.push(ownership);
  return { writer, ownership };
};
const inventoryPath = () => join(output, ".allure-output.json");
const readInventory = async () => JSON.parse(await readFile(inventoryPath(), "utf8"));
beforeEach(async () => {
  await feature("report-output-ownership");
  await story("filesystem-inventory");
  output = await mkdtemp(join(tmpdir(), "allure-ownership-"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(owners.splice(0).map((ownership) => ownership.stop()));
  await rm(output, { recursive: true, force: true });
});

it("records successful writes and relocation without adopting unrelated files", async () => {
  await writeFile(join(output, "user.txt"), "user");
  const { writer, ownership } = createWriter();
  ownership.begin();
  await writer.addFile("awesome/index.html", Buffer.from("report"));
  ownership.record("awesome/index.html", "awesome");
  await writer.addFile("awesome/chunks/chart.js", Buffer.from("chart"));
  ownership.record("awesome/chunks/chart.js", "awesome");
  await fs.rename(join(output, "awesome/index.html"), join(output, "index.html"));
  ownership.relocate("awesome/index.html", "index.html");
  await fs.rename(join(output, "awesome/chunks"), join(output, "chunks"));
  ownership.relocate("awesome/chunks", "chunks");
  await writer.addFile("test-results.json", Buffer.from("[]"));
  await ownership.finish("awesome");
  expect(await readInventory()).toEqual({
    version: 1,
    files: [
      { path: "chunks/chart.js", pluginId: "awesome" },
      { path: "index.html", pluginId: "awesome" },
      { path: "test-results.json" },
    ],
    layout: { awesome: "" },
  });
  expect(await readFile(join(output, "user.txt"), "utf8")).toBe("user");
});

it("direct sessions without staging union previous ownership and leave stale files in place", async () => {
  const { writer, ownership } = createWriter();
  ownership.begin();
  await writer.addFile("old.js", Buffer.from("old"));
  ownership.record("old.js", "old-plugin");
  await ownership.finish("old-plugin");
  await ownership.stop();
  const { writer: next, ownership: nextOwnership } = createWriter();
  nextOwnership.begin();
  await next.addFile("new/index.html", Buffer.from("new"));
  nextOwnership.record("new/index.html", "new");
  await nextOwnership.finish();
  expect(await readInventory()).toEqual({
    version: 1,
    files: [
      { path: "new/index.html", pluginId: "new" },
      { path: "old.js", pluginId: "old-plugin" },
    ],
    layout: { new: "new" },
  });
  expect(await readFile(join(output, "old.js"), "utf8")).toBe("old");
});

it.each([
  "a user-owned document",
  "null",
  JSON.stringify({ version: 2, files: [], layout: {} }),
  JSON.stringify({ version: 1, files: [{ path: "../outside" }], layout: {} }),
  JSON.stringify({ version: 1, files: [{ path: "C:/outside" }], layout: {} }),
  JSON.stringify({ version: 1, files: [{ path: "x" }, { path: "x" }], layout: {} }),
  JSON.stringify({ version: 1, files: [{ path: "x", pluginId: "" }], layout: {} }),
  JSON.stringify({ version: 1, files: [{ path: ".allure-output.lock" }], layout: {} }),
  JSON.stringify({ version: 1, files: [], layout: { awesome: "../outside" } }),
])("preserves invalid or reserved existing metadata: %s", async (content) => {
  await writeFile(inventoryPath(), content);
  const { writer, ownership } = createWriter();
  ownership.begin();
  await writer.addFile("index.html", Buffer.from("report"));
  await ownership.finish();
  expect(await readFile(inventoryPath(), "utf8")).toBe(content);
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("report");
});

it("does not follow metadata or nested file symlinks", async () => {
  const external = await mkdtemp(join(tmpdir(), "allure-ownership-external-"));
  try {
    const target = join(external, "user.txt");
    await writeFile(target, "user");
    await symlink(target, inventoryPath());
    const skipped = createWriter().ownership;
    skipped.begin();
    await skipped.finish();
    await skipped.stop();
    expect(await readFile(target, "utf8")).toBe("user");
    await rm(inventoryPath());
    const { writer, ownership } = createWriter();
    ownership.begin();
    await symlink(external, join(output, "linked"), "junction");
    await expect(writer.addFile("linked/user.txt", Buffer.from("overwrite"))).rejects.toThrow("Symbolic link");
    await ownership.finish();
    expect(await readFile(target, "utf8")).toBe("user");
    await expect(readFile(inventoryPath())).rejects.toThrow();
  } finally {
    await rm(external, { recursive: true, force: true });
  }
});

it("preserves prior metadata when a write fails even if the plugin catches the error", async () => {
  const previous = JSON.stringify({ version: 1, files: [], layout: {} });
  await writeFile(inventoryPath(), previous);
  const { writer, ownership } = createWriter();
  ownership.begin();
  await mkdir(join(output, "occupied"));
  await expect(writer.addFile("occupied", Buffer.from("bad"))).rejects.toThrow();
  await writer.addFile("valid.txt", Buffer.from("valid"));
  await ownership.finish();
  expect(await readFile(inventoryPath(), "utf8")).toBe(previous);
});

it("keeps the old inventory and removes the temporary file if publication fails", async () => {
  const previous = JSON.stringify({ version: 1, files: [], layout: {} });
  await writeFile(inventoryPath(), previous);
  const { writer, ownership } = createWriter();
  ownership.begin();
  await writer.addFile("index.html", Buffer.from("report"));
  vi.mocked(fs.rename).mockRejectedValueOnce(new Error("rename failed"));
  await expect(ownership.finish()).rejects.toThrow("rename failed");
  await ownership.stop();
  expect(await readFile(inventoryPath(), "utf8")).toBe(previous);
  expect((await readdir(output)).sort()).toEqual([".allure-output.json", "index.html"]);
});

it("does not retain ownership from an earlier lifecycle when the inventory disappears", async () => {
  const { writer, ownership } = createWriter();
  ownership.begin();
  await writer.addFile("old.txt", Buffer.from("old"));
  await ownership.finish();
  await rm(inventoryPath());
  await ownership.stop();
  ownership.begin();
  await writer.addFile("new.txt", Buffer.from("new"));
  await ownership.finish();
  expect((await readInventory()).files).toEqual([{ path: "new.txt" }]);
});

it("skips inventory publication when its path becomes a symlink", async () => {
  const { writer, ownership } = createWriter();
  ownership.begin();
  await writer.addFile("index.html", Buffer.from("report"));
  await writeFile(join(output, "user.txt"), "user");
  await symlink(join(output, "user.txt"), inventoryPath());
  await expect(ownership.finish()).resolves.toBeUndefined();
  expect(await readFile(join(output, "user.txt"), "utf8")).toBe("user");
});

it("records a thousand concurrent writes without losing ownership entries", async () => {
  const { writer, ownership } = createWriter();
  const paths = Array.from({ length: 1000 }, (_, index) => `data/${index}.json`);
  ownership.begin();
  await Promise.all(paths.map((path) => writer.addFile(path, Buffer.from(path))));
  await ownership.finish();
  const result = await readInventory();
  expect(result.files).toHaveLength(paths.length);
  expect(new Set(result.files.map((file: { path: string }) => file.path))).toEqual(new Set(paths));
  expect(await readFile(join(output, "data/999.json"), "utf8")).toBe("data/999.json");
});

it("preserves a user file appearing at the reserved metadata path during generation", async () => {
  const { writer, ownership } = createWriter();
  ownership.begin();
  await writer.addFile("index.html", Buffer.from("report"));
  await writeFile(inventoryPath(), "user content");
  await expect(ownership.finish()).resolves.toBeUndefined();
  expect(await readFile(inventoryPath(), "utf8")).toBe("user content");
});

it.each([".allure-output.json", ".ALLURE-OUTPUT.JSON", ".allure-output.json.", ".allure-output.json "])(
  "preserves legacy plugin metadata filename (%s) without publishing an inventory",
  async (name) => {
    const { writer, ownership } = createWriter();
    ownership.begin();
    await writer.addFile(`awesome/${name}`, Buffer.from("plugin"));
    await ownership.finish();
    expect(await readFile(join(output, "awesome", name), "utf8")).toBe("plugin");
    await expect(readFile(inventoryPath())).rejects.toThrow();
  },
);

it("orders persisted paths independently of the user's locale", async () => {
  const { writer, ownership } = createWriter();
  ownership.begin();
  for (const name of ["ä.json", "z.json", "a.json"]) await writer.addFile(name, Buffer.from(name));
  await ownership.finish();
  expect((await readInventory()).files).toEqual([{ path: "a.json" }, { path: "z.json" }, { path: "ä.json" }]);
});

it("rejects a concurrent generator and allows a new generation after release", async () => {
  const first = createWriter(),
    second = createWriter();
  first.ownership.begin();
  await first.ownership.acquire();
  second.ownership.begin();
  await expect(second.ownership.acquire()).rejects.toThrow("Report output is locked");
  await second.ownership.stop();
  await first.writer.addFile("first.txt", Buffer.from("first"));
  await first.ownership.finish();
  await first.ownership.stop();
  second.ownership.begin();
  await second.writer.addFile("second.txt", Buffer.from("second"));
  await second.ownership.finish();
  expect((await readInventory()).files).toEqual([{ path: "first.txt" }, { path: "second.txt" }]);
});

it("does not release a writer's current lock when begin is called again", async () => {
  const { writer, ownership } = createWriter();
  ownership.begin();
  expect(() => ownership.begin()).toThrow("Report output is locked");
  await writer.addFile("index.html", Buffer.from("report"));
  await ownership.finish();
  expect((await readInventory()).files).toEqual([{ path: "index.html" }]);
});

it("does not remove an existing lock or a replacement lock owned by another writer", async () => {
  const lock = join(output, ".allure-output.lock");
  await writeFile(lock, "existing lock");
  const { ownership } = createWriter();
  ownership.begin();
  await expect(ownership.acquire()).rejects.toThrow("Report output is locked");
  await ownership.stop();
  expect(await readFile(lock, "utf8")).toBe("existing lock");
  await rm(lock);
  ownership.begin();
  await ownership.acquire();
  await rm(lock);
  await writeFile(lock, "replacement lock");
  await ownership.stop();
  expect(await readFile(lock, "utf8")).toBe("replacement lock");
});

it("holds the lock until outstanding native writes settle", async () => {
  const { writer, ownership } = createWriter();
  ownership.begin();
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(fs.writeFile).mockImplementationOnce(async (...args) => {
    entered();
    await gate;
    await actual.writeFile(...args);
  });
  const write = writer.addFile("held.txt", Buffer.from("held"));
  await started;
  const stopped = ownership.stop();
  const contender = createWriter().ownership;
  contender.begin();
  await expect(contender.acquire()).rejects.toThrow("Report output is locked");
  release();
  await Promise.all([write, stopped]);
  const next = createWriter().ownership;
  next.begin();
  await next.acquire();
  await next.stop();
  expect(await readFile(join(output, "held.txt"), "utf8")).toBe("held");
});

it("honors a lock held by another Node process", async () => {
  const moduleUrl = new URL("../src/outputOwnership.ts", import.meta.url).href;
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { createJiti } from "jiti";
    const { OutputOwnership } = await createJiti(import.meta.url).import(${JSON.stringify(moduleUrl)});
    const owner = new OutputOwnership(${JSON.stringify(output)});
    owner.begin();
    await owner.acquire();
    console.log("locked");
    process.stdin.once("data", async () => { await owner.stop(); process.exit(0); });
    process.stdin.resume();
  `,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  try {
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw new Error("Lock holder exited before acquiring the lock");
      }),
    ]);
    const contender = createWriter().ownership;
    contender.begin();
    await expect(contender.acquire()).rejects.toThrow("Report output is locked");
    const exited = once(child, "exit");
    child.stdin.end("release");
    await exited;
    const next = createWriter().ownership;
    next.begin();
    await next.acquire();
    await next.stop();
  } finally {
    child.kill();
  }
});

it.each([".allure-output.lock", ".ALLURE-OUTPUT.LOCK", ".allure-output.lock.", "nested/.allure-output.lock . "])(
  "rejects reserved lock aliases before writing (%s)",
  async (name) => {
    const { writer, ownership } = createWriter();
    ownership.begin();
    await expect(writer.addFile(name, Buffer.from("plugin"))).rejects.toThrow("Reserved report output path");
    await ownership.stop();
    await expect(readFile(inventoryPath())).rejects.toThrow();
  },
);
it("rejects a missing staged file before publication without changing the previous report", async () => {
  await writeFile(join(output, "index.html"), "previous");
  await writeFile(inventoryPath(), JSON.stringify({ version: 1, files: [{ path: "index.html" }], layout: {} }));
  const { writer, ownership } = createWriter();
  ownership.begin();
  await ownership.stage();
  const staged = await writer.addFile("new.js", Buffer.from("new"));
  await rm(staged);
  await expect(ownership.preflight()).rejects.toThrow("Missing staged report files");
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("previous");
});

it("stages valid empty inventories on successive generations", async () => {
  await writeFile(inventoryPath(), JSON.stringify({ version: 1, files: [], layout: {} }));
  const { ownership } = createWriter();
  for (let generation = 0; generation < 2; generation++) {
    ownership.begin();
    await ownership.stage();
    expect(ownership.pendingReplacement).toBe(true);
    expect(ownership.directory).not.toBe(output);
    await ownership.finish();
    await ownership.stop();
    expect((await readInventory()).files).toEqual([]);
  }
});

it("preserves locks when the filesystem cannot provide a reliable inode identity", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
    const handle = await actual.open(...args);
    const stats = await handle.stat();
    vi.spyOn(handle, "stat").mockResolvedValue(Object.assign(stats, { ino: 0 }));
    return handle;
  });
  const { ownership } = createWriter();
  ownership.begin();
  await ownership.acquire();
  await ownership.stop();
  expect(await readFile(join(output, ".allure-output.lock"), "utf8")).toContain(String(process.pid));
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Cannot verify report lock identity"));
});
