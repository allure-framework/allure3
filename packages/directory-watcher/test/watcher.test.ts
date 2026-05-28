import { createHash, randomUUID } from "node:crypto";
import { Dirent, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  delayedFileProcessingWatcher,
  difference,
  findMatching,
  md5File,
  newFilesInDirectoryWatcher,
} from "../src/watcher.js";

let fixturesDir: string;

const randomFile = async (parent: string, name: string = `${randomUUID()}.txt`): Promise<string> => {
  const file = join(parent, name);
  await writeFile(file, `contents of the ${name}`, "utf8");
  return file;
};

const randomDirectory = async (parent: string, name: string = `${randomUUID()}`): Promise<string> => {
  const file = join(parent, name);
  await mkdir(file, { recursive: true });
  return file;
};

beforeEach(async () => {
  vi.clearAllMocks();
  try {
    fixturesDir = await mkdtemp("watcher.test.ts-");
  } catch (err) {}
});

afterEach(async () => {
  try {
    await rm(fixturesDir, { recursive: true });
  } catch (err) {}
});

describe("newFilesInDirectoryWatcher", () => {
  let abortController: AbortController;
  beforeEach(async () => {
    abortController = new AbortController();
  });

  afterEach(async () => {
    if (abortController) {
      abortController.abort("test end");
    }
  });

  it("calls the callback when file is created", async () => {
    const handler = vi.fn();
    newFilesInDirectoryWatcher(fixturesDir, handler, { indexDelay: 10, abortController });

    const file = join(fixturesDir, "file.txt");
    await writeFile(file, "content", "utf8");
    await setTimeout(200);

    expect(handler).toBeCalledTimes(1);
    expect(handler).toBeCalledWith(file, expect.any(Dirent));
  });

  it("calls the callback only when file is created", async () => {
    const handler = vi.fn();
    newFilesInDirectoryWatcher(fixturesDir, handler, { indexDelay: 10, abortController });

    const file = join(fixturesDir, "file.txt");
    await writeFile(file, "content", "utf8");
    await setTimeout(100);

    expect(handler).toBeCalledTimes(1);
    expect(handler).toBeCalledWith(file, expect.any(Dirent));
  });

  it("doesn't call the callback when unwatched", async () => {
    const handler = vi.fn();
    const { abort } = newFilesInDirectoryWatcher(fixturesDir, handler, { abortController });

    await abort();

    const file = join(fixturesDir, "file.txt");
    await writeFile(file, "content", "utf8");
    await setTimeout(200);
    await rm(file);
    await setTimeout(200);

    expect(handler).not.toHaveBeenCalled();
  });

  it("should watch not existing directory", async () => {
    const handler = vi.fn();
    const target = join(fixturesDir, "not-existing");
    newFilesInDirectoryWatcher(target, handler, { indexDelay: 10, abortController });

    await mkdir(target);

    const file = join(target, "file.txt");
    await writeFile(file, "content", "utf8");
    await setTimeout(200);

    expect(handler).toBeCalledWith(file, expect.any(Dirent));
  });

  it("should watch not existing nested directory", async () => {
    const handler = vi.fn();
    const target = join(fixturesDir, "not/existing/");
    const { abort } = newFilesInDirectoryWatcher(target, handler, { indexDelay: 10, abortController });

    await setTimeout(50);

    await mkdir(target, { recursive: true });

    const file = join(target, "file.txt");
    await writeFile(file, "content", "utf8");
    await setTimeout(50);

    expect(handler).toBeCalledWith(file, expect.any(Dirent));
  });

  it("should keep watching deleted directory", async () => {
    const handler = vi.fn();
    const target = join(fixturesDir, "will-be-deleted");
    await mkdir(target);

    const { abort } = newFilesInDirectoryWatcher(target, handler, { indexDelay: 10, abortController });

    await setTimeout(50);

    await rm(target, { recursive: true });

    await setTimeout(50);

    await mkdir(target);

    const file = join(target, "file.txt");
    await writeFile(file, "content", "utf8");
    await setTimeout(50);

    expect(handler).toBeCalledWith(file, expect.any(Dirent));
  });

  it("should finish initial scan on abort", async () => {
    const handler = vi.fn();
    const longRunningHandler = (...args: any[]) =>
      setTimeout(100).then(() => {
        return handler(...args);
      });

    const file = join(fixturesDir, "file.txt");
    await writeFile(file, "content", "utf8");
    const { abort } = newFilesInDirectoryWatcher(fixturesDir, longRunningHandler, { indexDelay: 200, abortController });
    await setTimeout(50);
    await abort();

    expect(handler).toBeCalledWith(file, expect.any(Dirent));
  });

  it("should finish last iteration on abort", async () => {
    const handler = vi.fn();
    const longRunningHandler = (...args: any[]) =>
      setTimeout(100).then(() => {
        return handler(...args);
      });

    const { abort } = newFilesInDirectoryWatcher(fixturesDir, longRunningHandler, {
      indexDelay: 10,
      ignoreInitial: true,
      abortController,
    });

    await setTimeout(10);

    const file = join(fixturesDir, "file.txt");
    await writeFile(file, "content", "utf8");

    await setTimeout(50);
    await abort();

    expect(handler).toBeCalledWith(file, expect.any(Dirent));
  });

  it("should keep processing in case of callback error", async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error("callback error"));

    newFilesInDirectoryWatcher(fixturesDir, handler, { indexDelay: 10, abortController });

    const file1 = join(fixturesDir, "file1.txt");
    await writeFile(file1, "content1", "utf8");

    const file2 = join(fixturesDir, "file2.txt");
    await writeFile(file2, "content2", "utf8");
    await setTimeout(20);

    await rm(file1);

    await setTimeout(200);

    expect(handler).toBeCalledWith(file1, expect.any(Dirent));
    expect(handler).toBeCalledWith(file2, expect.any(Dirent));
  });

  it("should resubmit files after directory recreation", async () => {
    const handler = vi.fn();
    const target = join(fixturesDir, "somedir");
    await mkdir(target);

    newFilesInDirectoryWatcher(target, handler, { indexDelay: 10, ignoreInitial: true, abortController });
    await setTimeout(50);

    const file = join(target, "file.txt");

    await writeFile(file, "content1", "utf8");

    await setTimeout(50);

    await rm(target, { recursive: true });

    await setTimeout(50);

    await mkdir(target);

    await writeFile(file, "content2", "utf8");
    await setTimeout(50);

    expect(handler).toBeCalledWith(file, expect.any(Dirent));
    expect(handler).toBeCalledTimes(2);
  });

  it("should await initial scan", async () => {
    const handler = vi.fn();

    const longRunningHandler = (...args: any[]) =>
      setTimeout(100).then(() => {
        return handler(...args);
      });

    const file1 = join(fixturesDir, "file1.txt");
    await writeFile(file1, "content1", "utf8");

    const { initialScan } = newFilesInDirectoryWatcher(fixturesDir, longRunningHandler, {
      indexDelay: 200,
      ignoreInitial: false,
      abortController,
    });

    await initialScan();

    const file2 = join(fixturesDir, "file2.txt");
    await writeFile(file2, "content2", "utf8");

    expect(handler).toBeCalledWith(file1, expect.any(Dirent));
    expect(handler).toBeCalledTimes(1);
  });

  it("should perform graceful shutdown", async () => {
    const handler = vi.fn();
    const watcher = newFilesInDirectoryWatcher(fixturesDir, handler, {
      indexDelay: 10_000,
      abortController,
    });
    await watcher.initialScan();
    const file1 = await randomFile(fixturesDir);
    const file2 = await randomFile(fixturesDir);

    await watcher.abort();
    expect(handler).toBeCalledWith(file1, expect.any(Dirent));
    expect(handler).toBeCalledWith(file2, expect.any(Dirent));
    expect(handler).toBeCalledTimes(2);
  });

  it("should discover every file under nested result directories during initial scan", async () => {
    const expectedFiles: string[] = [];

    for (let groupIndex = 0; groupIndex < 12; groupIndex++) {
      const groupDirectory = join(fixturesDir, "build", "allure-results", `matrix-${groupIndex}`, "attachments");
      await mkdir(groupDirectory, { recursive: true });

      for (let fileIndex = 0; fileIndex < 25; fileIndex++) {
        const file = join(groupDirectory, `${groupIndex}-${fileIndex}-attachment.txt`);
        expectedFiles.push(file);
        await writeFile(file, `attachment ${groupIndex}:${fileIndex}`, "utf8");
      }
    }

    const seenFiles = new Set<string>();
    const handler = vi.fn(async (file: string) => {
      seenFiles.add(file);
    });
    const watcher = newFilesInDirectoryWatcher(fixturesDir, handler, {
      indexDelay: 10_000,
      abortController,
    });

    await watcher.initialScan();
    await watcher.abort();

    expect(handler).toBeCalledTimes(expectedFiles.length);
    expect(seenFiles).toHaveLength(expectedFiles.length);
    for (const file of expectedFiles) {
      expect(seenFiles).toContain(file);
    }
  });

  it("should limit recursive discovery by maximum depth", async () => {
    const firstLevelDirectory = await randomDirectory(fixturesDir, "first");
    const secondLevelDirectory = await randomDirectory(firstLevelDirectory, "second");
    const rootFile = await randomFile(fixturesDir, "root.txt");
    const firstLevelFile = await randomFile(firstLevelDirectory, "first.txt");
    const secondLevelFile = await randomFile(secondLevelDirectory, "second.txt");

    const seenFiles = new Set<string>();
    const handler = vi.fn(async (file: string) => {
      seenFiles.add(file);
    });
    const watcher = newFilesInDirectoryWatcher(fixturesDir, handler, {
      indexDelay: 10_000,
      maximumDepth: 1,
      abortController,
    });

    await watcher.initialScan();
    await watcher.abort();

    expect(handler).toBeCalledTimes(2);
    expect(seenFiles).toContain(rootFile);
    expect(seenFiles).toContain(firstLevelFile);
    expect(seenFiles).not.toContain(secondLevelFile);
  });

  it("should use a default maximum depth of 10", async () => {
    let currentDirectory = fixturesDir;
    for (let depth = 1; depth <= 10; depth++) {
      currentDirectory = await randomDirectory(currentDirectory, `level-${depth}`);
    }
    const depth10File = await randomFile(currentDirectory, "depth-10.txt");
    const depth11Directory = await randomDirectory(currentDirectory, "level-11");
    const depth11File = await randomFile(depth11Directory, "depth-11.txt");

    const seenFiles = new Set<string>();
    const handler = vi.fn(async (file: string) => {
      seenFiles.add(file);
    });
    const watcher = newFilesInDirectoryWatcher(fixturesDir, handler, {
      indexDelay: 10_000,
      abortController,
    });

    await watcher.initialScan();
    await watcher.abort();

    expect(handler).toBeCalledTimes(1);
    expect(seenFiles).toContain(depth10File);
    expect(seenFiles).not.toContain(depth11File);
  });
});

describe("findMatching", () => {
  it("it should find specified directories", async () => {
    const file1 = await randomFile(fixturesDir);
    const file2 = await randomFile(fixturesDir);
    const dir1 = await randomDirectory(fixturesDir);
    const dir12 = await randomDirectory(dir1, "allure-results");
    const file3 = await randomFile(dir12);
    const dir2 = await randomDirectory(fixturesDir, "allure-results");
    const file4 = await randomFile(dir2);

    const result = new Set<string>();
    await findMatching(fixturesDir, result, (dirent) => dirent.isDirectory() && dirent.name === "allure-results");

    expect(result).toHaveLength(2);
    expect(result).toContain(dir12);
    expect(result).toContain(dir2);
  });

  it("it should not continue search on the matched directories", async () => {
    const file1 = await randomFile(fixturesDir);
    const file2 = await randomFile(fixturesDir);
    const dir1 = await randomDirectory(fixturesDir);
    const dir12 = await randomDirectory(dir1, "allure-results");
    const file3 = await randomFile(dir12);
    const dir2 = await randomDirectory(fixturesDir, "allure-results");
    const file4 = await randomFile(dir2);
    const dir3 = await randomDirectory(fixturesDir, "allure-results");
    const dir31 = await randomDirectory(dir3, "allure-results");
    const dir32 = await randomDirectory(dir3);
    const file5 = await randomFile(dir31);
    const file6 = await randomFile(dir32);
    const file7 = await randomFile(dir32);

    const result = new Set<string>();
    await findMatching(fixturesDir, result, (dirent) => dirent.isDirectory() && dirent.name === "allure-results");

    expect(result).does.not.contain(dir31);
  });

  it("it should limit the search depth", async () => {
    const file1 = await randomFile(fixturesDir);
    const file2 = await randomFile(fixturesDir);
    const dir1 = await randomDirectory(fixturesDir);
    const dir12 = await randomDirectory(dir1, "allure-results");
    const file3 = await randomFile(dir12);
    const dir2 = await randomDirectory(fixturesDir, "allure-results");
    const file4 = await randomFile(dir2);
    const dir3 = await randomDirectory(fixturesDir);
    const dir31 = await randomDirectory(dir3);
    const dir311 = await randomDirectory(dir31, "allure-results");
    const dir312 = await randomDirectory(dir31);
    const file5 = await randomFile(dir311);
    const file6 = await randomFile(dir312);
    const file7 = await randomFile(dir312);

    const result = new Set<string>();
    await findMatching(fixturesDir, result, (dirent) => dirent.isDirectory() && dirent.name === "allure-results", 1);

    expect(result).does.not.contain(dir311);
  });
});

describe("difference", () => {
  it("should calculate diff", async () => {
    const before = new Set<string>(["first", "second"]);
    const after = new Set<string>(["third", "first"]);
    const [added, deleted] = difference(before, after);

    expect(added).toContain("third");
    expect(added).toHaveLength(1);
    expect(deleted).toContain("second");
    expect(deleted).toHaveLength(1);
  });
});

describe("md5File", () => {
  it("should calculate file hash", async () => {
    const file = join(fixturesDir, "file.txt");
    await writeFile(file, "some file content", "utf8");
    const hash = await md5File(file);
    const expected = createHash("md5").update("some file content").digest("hex");
    expect(hash).toEqual(expected);
  });
});

describe("delayedFileProcessingWatcher", () => {
  let abortController: AbortController;
  beforeEach(async () => {
    abortController = new AbortController();
  });

  afterEach(async () => {
    if (abortController) {
      abortController.abort("test end");
    }
  });

  it("should delay file execution until file stop changing", async () => {
    const handler = vi.fn();
    const watcher = delayedFileProcessingWatcher(handler, {
      indexDelay: 10,
      minProcessingDelay: 200,
      abortController,
    });
    const file = join(fixturesDir, "changing-file.txt");
    const writeStream = createWriteStream(file, { flags: "a", encoding: "utf-8" });
    writeStream.write("first\n");
    await watcher.addFile(file);
    for (let i = 0; i < 10; i++) {
      await setTimeout(10);
      writeStream.write(`line${i}\n`);
    }
    writeStream.end();

    expect(handler).toBeCalledTimes(0);

    await setTimeout(120);

    expect(handler).toBeCalledTimes(1);
    const expectedPath = await realpath(file);
    expect(handler).toBeCalledWith(expectedPath);
  });

  it("should wait for processing delay on abort", async () => {
    const handler = vi.fn();
    const watcher = delayedFileProcessingWatcher(handler, {
      indexDelay: 10,
      minProcessingDelay: 200,
      abortController,
    });
    const file = join(fixturesDir, "changing-file.txt");
    const writeStream = createWriteStream(file, { flags: "a", encoding: "utf-8" });
    writeStream.write("first\n");
    await watcher.addFile(file);
    for (let i = 0; i < 10; i++) {
      await setTimeout(10);
      writeStream.write(`line${i}\n`);
    }
    writeStream.end();
    await watcher.abort();

    expect(handler).toBeCalledTimes(1);
    const expectedPath = await realpath(file);
    expect(handler).toBeCalledWith(expectedPath);
  });

  it("should honor processing delay on abort for stable files", async () => {
    const handler = vi.fn();
    const watcher = delayedFileProcessingWatcher(handler, {
      indexDelay: 10_000,
      minProcessingDelay: 200,
      maxProcessingDelay: 1_000,
      abortController,
    });
    const file = join(fixturesDir, "stable-file.txt");
    await writeFile(file, "content", "utf8");
    await watcher.addFile(file);

    const startedAt = Date.now();
    await watcher.abort();
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(handler).toBeCalledTimes(1);
    const expectedPath = await realpath(file);
    expect(handler).toBeCalledWith(expectedPath);
  });
});
