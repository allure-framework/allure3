import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { feature, story } from "allure-js-commons";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { OutputTransaction, transactionDirectory } from "../src/outputTransaction.js";

vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return { ...actual, rename: vi.fn(actual.rename), rm: vi.fn(actual.rm) };
});

let output: string;
const transactions: OutputTransaction[] = [];
const stage = async (previous: string[], files: Record<string, string>) => {
  const transaction = await OutputTransaction.create(output, previous, []);
  transactions.push(transaction);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(transaction.stage, path, ".."), { recursive: true });
    await writeFile(join(transaction.stage, path), content);
  }
  return transaction;
};
beforeEach(async () => {
  await feature("report-output-transactions");
  await story("replacement-and-recovery");
  output = await mkdtemp(join(tmpdir(), "allure-output-transaction-"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(transactions.splice(0).map((transaction) => transaction.dispose()));
  await rm(output, { recursive: true, force: true });
});

it("retires only recorded files and installs resources before entry HTML", async () => {
  await writeFile(join(output, "old.js"), "old");
  await writeFile(join(output, "index.html"), "old html");
  await writeFile(join(output, "user.txt"), "user");
  const transaction = await stage(["old.js", "index.html"], { "index.html": "new html", "new.js": "new" });
  await transaction.commit(["index.html", "new.js"], "new inventory");
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("new html");
  expect(await readFile(join(output, "new.js"), "utf8")).toBe("new");
  expect(await readFile(join(output, "user.txt"), "utf8")).toBe("user");
  await expect(readFile(join(output, "old.js"))).rejects.toMatchObject({ code: "ENOENT" });
  const installs = vi.mocked(fs.rename).mock.calls.filter(([source]) => String(source).startsWith(transaction.stage));
  const targets = installs.map(([, target]) => String(target));
  expect(targets.indexOf(join(output, "new.js"))).toBeLessThan(targets.indexOf(join(output, "index.html")));
  expect(targets.indexOf(join(output, "index.html"))).toBeLessThan(
    targets.indexOf(join(output, ".allure-output.json")),
  );
  expect(await readdir(output)).not.toContain(transactionDirectory);
});

it("restores all old content when installation fails after a resource was installed", async () => {
  await writeFile(join(output, "index.html"), "old html");
  await writeFile(join(output, "old.js"), "old");
  await writeFile(join(output, ".allure-output.json"), "old inventory");
  const transaction = await stage(["old.js", "index.html"], { "new.js": "new", "index.html": "new html" });
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(fs.rename).mockImplementation(async (source, target) => {
    if (source === join(transaction.stage, "index.html")) throw new Error("install failed");
    return actual.rename(source, target);
  });
  await expect(transaction.commit(["new.js", "index.html"], "new inventory")).rejects.toThrow("install failed");
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("old html");
  expect(await readFile(join(output, "old.js"), "utf8")).toBe("old");
  expect(await readFile(join(output, ".allure-output.json"), "utf8")).toBe("old inventory");
  await expect(readFile(join(output, "new.js"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readdir(output)).not.toContain(transactionDirectory);
});

it("preserves recovery data and reports both installation and rollback failures", async () => {
  await writeFile(join(output, "index.html"), "old html");
  const transaction = await stage(["index.html"], { "index.html": "new html" });
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(fs.rename).mockImplementation(async (source, target) => {
    if (source === join(transaction.stage, "index.html")) throw new Error("install failed");
    if (String(source).includes(join(transactionDirectory, "files"))) throw new Error("restore failed");
    return actual.rename(source, target);
  });
  await expect(transaction.commit(["index.html"], "new inventory")).rejects.toMatchObject({
    cause: { message: "install failed" },
    errors: [{ message: "install failed" }, { message: "restore failed" }],
  });
  expect(await readFile(join(output, transactionDirectory, "files/index.html"), "utf8")).toBe("old html");
  await expect(OutputTransaction.checkRecovery(output)).rejects.toThrow("needs recovery");
  // The stage is deliberately retained for manual recovery; this test owns its cleanup.
  await rm(transaction.stage, { recursive: true });
});

it.each(["invalid", "installing"])("blocks a %s recovery journal without changing files", async (state) => {
  const backup = join(output, transactionDirectory);
  await mkdir(backup);
  if (state !== "missing")
    await writeFile(
      join(backup, "journal.json"),
      state === "invalid"
        ? "broken"
        : JSON.stringify({
            version: 1,
            output,
            status: "installing",
            previous: [],
            next: [],
            stage: "unused",
          }),
    );
  await expect(OutputTransaction.checkRecovery(output)).rejects.toThrow("needs recovery");
  expect(await readdir(output)).toContain(transactionDirectory);
});

it.each(["committed", "rolled-back"])("cleans a terminal %s recovery journal", async (status) => {
  const backup = join(output, transactionDirectory);
  await mkdir(backup);
  await writeFile(
    join(backup, "journal.json"),
    JSON.stringify({ version: 1, output, status, stage: join(backup, "stage"), previous: [], next: [] }),
  );
  await OutputTransaction.checkRecovery(output);
  expect(await readdir(output)).toEqual([]);
});

it("rejects symlink and file-parent targets before moving the old report", async () => {
  await writeFile(join(output, "user.txt"), "user");
  await symlink(join(output, "user.txt"), join(output, "index.html"));
  const transaction = await stage([], { "index.html": "report" });
  await expect(transaction.preflight(["index.html"])).rejects.toThrow("Unsafe report replacement target");
  await expect(transaction.preflight(["data", "data/test.json"])).rejects.toThrow("parent directory");
  expect(await readFile(join(output, "user.txt"), "utf8")).toBe("user");
  expect(JSON.parse(await readFile(join(output, transactionDirectory, "journal.json"), "utf8")).status).toBe("staging");
});

it("keeps a successful report when backup cleanup fails and retries terminal cleanup later", async () => {
  const transaction = await stage([], { "index.html": "report" });
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(fs.rm).mockImplementation(async (path, options) => {
    if (path === join(output, transactionDirectory)) throw new Error("cleanup failed");
    return actual.rm(path, options);
  });
  await transaction.commit(["index.html"], "inventory");
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("report");
  expect(console.warn).toHaveBeenCalled();
  vi.mocked(fs.rm).mockImplementation(actual.rm);
  await OutputTransaction.checkRecovery(output);
  expect(await readdir(output)).not.toContain(transactionDirectory);
});

it("replaces a large resource set while preserving nested user files", async () => {
  const files = Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`assets/${index}.js`, "old"]));
  await mkdir(join(output, "assets"));
  await Promise.all(Object.keys(files).map((path) => writeFile(join(output, path), "old")));
  await writeFile(join(output, "assets/user.txt"), "user");
  const next = Object.fromEntries(Array.from({ length: 750 }, (_, index) => [`assets/${index + 500}.js`, "new"]));
  const transaction = await stage(Object.keys(files), next);
  await transaction.commit(Object.keys(next), "inventory");
  const actual = await readdir(join(output, "assets"));
  expect(actual.sort()).toEqual([...Object.keys(next).map((path) => path.slice("assets/".length)), "user.txt"].sort());
  expect(await readFile(join(output, "assets/500.js"), "utf8")).toBe("new");
  expect(await readFile(join(output, "assets/1249.js"), "utf8")).toBe("new");
  expect(await readFile(join(output, "assets/user.txt"), "utf8")).toBe("user");
}, 30_000);

it.each([false, true])("cleans interrupted journal preparation with temporary file=%s", async (temporary) => {
  const backup = join(output, transactionDirectory);
  await mkdir(backup);
  if (temporary) await writeFile(join(backup, "00000000-0000-0000-0000-000000000000.tmp"), "partial");
  await OutputTransaction.checkRecovery(output);
  expect(await readdir(output)).toEqual([]);
});

it("preserves journal-less backups containing actual files", async () => {
  const backup = join(output, transactionDirectory);
  await mkdir(join(backup, "files"), { recursive: true });
  await writeFile(join(backup, "files/old.js"), "old");
  await expect(OutputTransaction.checkRecovery(output)).rejects.toThrow("needs recovery");
  expect(await readFile(join(backup, "files/old.js"), "utf8")).toBe("old");
});

it("cleans an interrupted staging phase without changing the previous report", async () => {
  await writeFile(join(output, "index.html"), "previous");
  const transaction = await stage(["index.html"], { "index.html": "pending" });
  expect(transaction.stage.startsWith(join(output, transactionDirectory))).toBe(true);
  await OutputTransaction.checkRecovery(output);
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("previous");
  expect(await readdir(output)).not.toContain(transactionDirectory);
});

it("backs up overwritten targets even when retirement and metadata publication are disabled", async () => {
  await writeFile(join(output, "index.html"), "old html");
  await writeFile(join(output, "same.js"), "old resource");
  await writeFile(join(output, ".allure-output.json"), "old metadata");
  const transaction = await stage(["index.html", "same.js"], { "same.js": "new resource", "index.html": "new html" });
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(fs.rename).mockImplementation(async (source, target) => {
    if (source === join(transaction.stage, "index.html")) throw new Error("install failed");
    return actual.rename(source, target);
  });
  await expect(transaction.commit(["same.js", "index.html"])).rejects.toThrow("install failed");
  expect(await readFile(join(output, "same.js"), "utf8")).toBe("old resource");
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("old html");
  expect(await readFile(join(output, ".allure-output.json"), "utf8")).toBe("old metadata");
});

it("preserves old filename casing when a case-only replacement is rolled back", async () => {
  await writeFile(join(output, "Chunk.js"), "old");
  const transaction = await stage(["Chunk.js"], { "chunk.js": "new", "Index.HTML": "html" });
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(fs.rename).mockImplementation(async (source, target) => {
    if (source === join(transaction.stage, "Index.HTML")) throw new Error("entry failed");
    return actual.rename(source, target);
  });
  await expect(transaction.commit(["Index.HTML", "chunk.js"], "inventory")).rejects.toThrow("entry failed");
  const moves = vi.mocked(fs.rename).mock.calls.map(([source]) => String(source));
  expect(moves.indexOf(join(transaction.stage, "chunk.js"))).toBeGreaterThanOrEqual(0);
  expect(moves.indexOf(join(transaction.stage, "chunk.js"))).toBeLessThan(
    moves.indexOf(join(transaction.stage, "Index.HTML")),
  );
  expect(await readFile(join(output, "Chunk.js"), "utf8")).toBe("old");
  expect(await readdir(output)).toEqual(["Chunk.js"]);
});

it("detects an installing journal after its writer is killed between native file moves", async () => {
  await writeFile(join(output, "index.html"), "previous");
  const moduleUrl = new URL("../src/outputTransaction.ts", import.meta.url).href;
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import fs from "node:fs/promises";
    import { syncBuiltinESMExports } from "node:module";
    import { join } from "node:path";
    import { createJiti } from "jiti";
    const output = ${JSON.stringify(output)};
    const rename = fs.rename;
    fs.rename = async (source, target) => {
      await rename(source, target);
      if (source === join(output, "index.html")) {
        process.stdout.write("backed up");
        await new Promise(() => {});
      }
    };
    syncBuiltinESMExports();
    const { OutputTransaction } = await createJiti(import.meta.url, { tryNative: false }).import(${JSON.stringify(moduleUrl)});
    const transaction = await OutputTransaction.create(output, ["index.html"], []);
    await fs.writeFile(join(transaction.stage, "index.html"), "next");
    // Keep the process alive while it is paused inside the rename hook.
    setInterval(() => {}, 1000);
    await transaction.commit(["index.html"], "inventory");
  `,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const exited = once(child, "exit");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Writer did not reach the native rename hook")), 10000);
      }),
      once(child.stdout, "data"),
      exited.then(() => {
        throw new Error("Writer exited before moving a file");
      }),
    ]);
    child.kill("SIGKILL");
    await exited;
    await expect(OutputTransaction.checkRecovery(output)).rejects.toThrow("needs recovery");
    expect(await readFile(join(output, transactionDirectory, "files/index.html"), "utf8")).toBe("previous");
    expect(JSON.parse(await readFile(join(output, transactionDirectory, "journal.json"), "utf8")).status).toBe(
      "installing",
    );
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exited;
    }
  }
}, 15000);

it("does not discard backups when a staging receipt contradicts actual recovery files", async () => {
  await stage([], {});
  await mkdir(join(output, transactionDirectory, "files"));
  await writeFile(join(output, transactionDirectory, "files/previous.txt"), "previous");
  await expect(OutputTransaction.checkRecovery(output)).rejects.toThrow("needs recovery");
  expect(await readFile(join(output, transactionDirectory, "files/previous.txt"), "utf8")).toBe("previous");
});

it("commits a successful case-only resource rename with the requested filename", async () => {
  await writeFile(join(output, "Chunk.js"), "old");
  const transaction = await stage(["Chunk.js"], { "chunk.js": "new" });
  await transaction.commit(["chunk.js"], "inventory");
  expect(await readFile(join(output, "chunk.js"), "utf8")).toBe("new");
  expect((await readdir(output)).sort()).toEqual([".allure-output.json", "chunk.js"]);
});

it("rejects concurrent and repeated commit calls without touching the completed report", async () => {
  await writeFile(join(output, "index.html"), "previous");
  const transaction = await stage(["index.html"], { "index.html": "next" });
  const first = transaction.commit(["index.html"], "inventory");
  await expect(transaction.commit(["index.html"], "other inventory")).rejects.toThrow("already started");
  await first;
  await expect(transaction.commit(["index.html"], "other inventory")).rejects.toThrow("already started");
  expect(await readFile(join(output, "index.html"), "utf8")).toBe("next");
  expect(await readFile(join(output, ".allure-output.json"), "utf8")).toBe("inventory");
  expect(await readdir(output)).not.toContain(transactionDirectory);
});

it.each(["EPERM", "EBUSY"])("restores completed backup moves when the next old file is locked (%s)", async (code) => {
  await writeFile(join(output, "first.js"), "old first");
  await writeFile(join(output, "locked.js"), "old locked");
  const transaction = await stage(["first.js", "locked.js"], { "first.js": "new first", "locked.js": "new locked" });
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  vi.mocked(fs.rename).mockImplementation(async (source, target) => {
    if (source === join(output, "locked.js")) throw Object.assign(new Error("file is locked"), { code });
    return actual.rename(source, target);
  });
  await expect(transaction.commit(["first.js", "locked.js"], "inventory")).rejects.toMatchObject({ code });
  expect(await readFile(join(output, "first.js"), "utf8")).toBe("old first");
  expect(await readFile(join(output, "locked.js"), "utf8")).toBe("old locked");
  expect(await readdir(output)).not.toContain(transactionDirectory);
});
