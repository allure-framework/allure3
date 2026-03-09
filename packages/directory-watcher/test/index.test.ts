import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import watchDirectory from "../src/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("watchDirectory", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    try {
      await mkdir(fixturesDir, { recursive: true });
    } catch (err) {}
  });

  afterEach(async () => {
    await rm(fixturesDir, { recursive: true });
  });

  it("calls the callback when file is created", async () => {
    const handler = vi.fn();
    const unwatch = watchDirectory(fixturesDir, handler);

    await writeFile(join(fixturesDir, "file.txt"), "content", "utf8");
    await sleep(200);

    expect(handler).toBeCalledWith("add", join(fixturesDir, "file.txt"));

    unwatch();
  });

  it("calls the callback when file is changed", async () => {
    const handler = vi.fn();
    const unwatch = watchDirectory(fixturesDir, handler);

    await writeFile(join(fixturesDir, "file.txt"), "content", "utf8");
    await sleep(200);
    await writeFile(join(fixturesDir, "file.txt"), "new content", "utf8");
    await sleep(200);

    expect(handler).toBeCalledWith("change", join(fixturesDir, "file.txt"));

    unwatch();
  });

  it("calls the callback when file is deleted", async () => {
    const handler = vi.fn();
    const unwatch = watchDirectory(fixturesDir, handler);

    const filePath = join(fixturesDir, "file.txt");
    await writeFile(filePath, "content", "utf8");
    await sleep(200);
    await rm(filePath);
    await sleep(200);

    expect(handler).toBeCalledWith("add", filePath);
    expect(handler).toBeCalledWith("unlink", filePath);

    unwatch();
  });

  it("doesn't call the callback when unwatched", async () => {
    const handler = vi.fn();
    const unwatch = watchDirectory(fixturesDir, handler);

    unwatch();

    await writeFile(join(fixturesDir, "file.txt"), "content", "utf8");
    await sleep(200);
    await rm(join(fixturesDir, "file.txt"));
    await sleep(200);

    expect(handler).not.toHaveBeenCalled();
  });

  it.skip("should watch not existing directory", async () => {
    const handler = vi.fn();
    const target = join(fixturesDir, "not-existing");
    const unwatch = watchDirectory(target, handler);

    await mkdir(target);

    const file = join(target, "file.txt");
    await writeFile(file, "content", "utf8");
    await sleep(200);

    expect(handler).toBeCalledWith("add", file);

    unwatch();
  });

  it.skip("should watch not existing nested directory", async () => {
    const handler = vi.fn();
    const target = join(fixturesDir, "not/existing/");
    const unwatch = watchDirectory(target, handler, { usePolling: false, ignoreInitial: true });

    await mkdir(target, { recursive: true });

    const file = join(target, "file.txt");
    await writeFile(file, "content", "utf8");
    await sleep(200);

    expect(handler).toBeCalledWith("add", file);

    unwatch();
  });

  it.skip("should keep watching deleted directory", async () => {
    const handler = vi.fn();
    const target = join(fixturesDir, "will-be-deleted");
    await mkdir(target);

    const unwatch = watchDirectory(target, handler);

    await rm(target, { recursive: true });

    await mkdir(target);

    const file = join(target, "file.txt");
    await writeFile(file, "content", "utf8");
    await sleep(200);

    expect(handler).toBeCalledWith("add", file);

    unwatch();
  });
});
