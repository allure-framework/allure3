import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SharedReportFiles } from "../src/sharedStorage.js";

describe("SharedReportFiles", () => {
  let outDir: string;
  let shared: SharedReportFiles;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "allure-shared-test-"));
    shared = new SharedReportFiles(outDir);
  });

  afterEach(async () => {
    if (outDir) {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  describe("keys", () => {
    it("writes a file once when the same key and content are added twice", async () => {
      const first = await shared.addFile("data/attachments/abc.json", Buffer.from("content"));
      const second = await shared.addFile("data/attachments/abc.json", Buffer.from("content"));

      expect(first).toBe(second);
    });

    it("fails instead of silently overwriting a key with different content", async () => {
      await shared.addFile("awesome/main.js", Buffer.from("first"));

      await expect(shared.addFile("awesome/main.js", Buffer.from("second"))).rejects.toThrow("_shared/awesome/main.js");
    });

    it("keeps files with the same name in different directories apart", async () => {
      const awesome = await shared.addFile("awesome/main.js", Buffer.from("awesome"));
      const classic = await shared.addFile("classic/main.js", Buffer.from("classic"));

      expect(awesome).toBe(resolve(outDir, "_shared", "awesome", "main.js"));
      expect(classic).toBe(resolve(outDir, "_shared", "classic", "main.js"));
      expect(await readFile(awesome, "utf-8")).toBe("awesome");
      expect(await readFile(classic, "utf-8")).toBe("classic");
    });

    it("returns an absolute path under the shared directory", async () => {
      const filePath = await shared.addFile("test.txt", Buffer.from("data"));

      expect(isAbsolute(filePath)).toBe(true);
      expect(filePath).toBe(resolve(outDir, "_shared", "test.txt"));
    });
  });

  describe("content deduplication", () => {
    it("stores identical content of different keys as a single file on disk", async () => {
      const first = await shared.addFile("data/attachments/one.png", Buffer.from("same bytes"));
      const second = await shared.addFile("data/attachments/two.png", Buffer.from("same bytes"));

      expect(first).not.toBe(second);
      expect(await readFile(second, "utf-8")).toBe("same bytes");
      expect((await stat(first)).ino).toBe((await stat(second)).ino);
    });

    it("keeps different content in different files", async () => {
      const first = await shared.addFile("one.txt", Buffer.from("one"));
      const second = await shared.addFile("two.txt", Buffer.from("two"));

      expect((await stat(first)).ino).not.toBe((await stat(second)).ino);
      expect(await readFile(first, "utf-8")).toBe("one");
      expect(await readFile(second, "utf-8")).toBe("two");
    });

    it("deduplicates content added concurrently", async () => {
      const paths = await Promise.all(
        Array.from({ length: 10 }, (_, index) => shared.addFile(`file${index}.txt`, Buffer.from("same bytes"))),
      );
      const inodes = await Promise.all(paths.map(async (path) => (await stat(path)).ino));

      expect(new Set(paths).size).toBe(10);
      expect(new Set(inodes).size).toBe(1);
    });

    it("writes a key added concurrently only once", async () => {
      const paths = await Promise.all(
        Array.from({ length: 10 }, () => shared.addFile("same.txt", Buffer.from("data"))),
      );

      expect(new Set(paths).size).toBe(1);
      expect(await readFile(paths[0], "utf-8")).toBe("data");
    });
  });
});
