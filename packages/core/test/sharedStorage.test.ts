import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SharedAssetsReportFiles, SharedReportFiles } from "../src/sharedStorage.js";

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

  describe("path-based deduplication", () => {
    it("returns the same path when writing the same path twice", async () => {
      const path1 = await shared.addFile("data/attachments/abc.json", Buffer.from("content1"));
      const path2 = await shared.addFile("data/attachments/abc.json", Buffer.from("content2"));

      expect(path1).toBe(path2);
    });

    it("creates separate files for different paths", async () => {
      await shared.addFile("a.txt", Buffer.from("content"));
      await shared.addFile("b.txt", Buffer.from("content"));

      const aExists = await stat(resolve(outDir, "_shared", "a.txt")).then(
        () => true,
        () => false,
      );
      const bExists = await stat(resolve(outDir, "_shared", "b.txt")).then(
        () => true,
        () => false,
      );

      expect(aExists).toBe(true);
      expect(bExists).toBe(true);
    });
  });

  describe("preserves directory structure", () => {
    it("preserves nested path under _shared/", async () => {
      const data = Buffer.from("attachment content");
      const resultPath = await shared.addFile("data/attachments/foo.png", data);

      expect(resultPath).toBe(resolve(outDir, "_shared", "data", "attachments", "foo.png"));

      const written = await readFile(resultPath, "utf-8");
      expect(written).toBe("attachment content");
    });

    it("writes flat files directly in _shared/", async () => {
      const resultPath = await shared.addFile("test.txt", Buffer.from("flat"));

      expect(resultPath).toBe(resolve(outDir, "_shared", "test.txt"));
    });
  });

  describe("concurrent writes", () => {
    it("handles simultaneous writes of the same path without errors", async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => shared.addFile("same.txt", Buffer.from("data"))),
      );

      const unique = new Set(results);
      expect(unique.size).toBe(1);
    });

    it("handles simultaneous writes of different paths correctly", async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) => shared.addFile(`file${i}.txt`, Buffer.from(`content-${i}`))),
      );

      const unique = new Set(results);
      expect(unique.size).toBe(5);
    });
  });

  describe("file written to disk", () => {
    it("writes the correct content", async () => {
      const content = "hello world";
      const resultPath = await shared.addFile("greeting.txt", Buffer.from(content));

      const written = await readFile(resultPath, "utf-8");
      expect(written).toBe(content);
    });
  });

  describe("returned path", () => {
    it("returns an absolute path", async () => {
      const resultPath = await shared.addFile("test.txt", Buffer.from("data"));

      expect(isAbsolute(resultPath)).toBe(true);
    });

    it("returns a path under _shared/", async () => {
      const resultPath = await shared.addFile("test.txt", Buffer.from("data"));

      expect(resultPath.startsWith(resolve(outDir, "_shared"))).toBe(true);
    });
  });
});

describe("SharedAssetsReportFiles", () => {
  let outDir: string;
  let assets: SharedAssetsReportFiles;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "allure-assets-test-"));
    assets = new SharedAssetsReportFiles(outDir);
  });

  afterEach(async () => {
    if (outDir) {
      await rm(outDir, { recursive: true, force: true });
    }
  });

  it("strips directory and keeps only filename", async () => {
    const resultPath = await assets.addFile("some/nested/style.css", Buffer.from("body{}"));

    expect(resultPath).toBe(resolve(outDir, "_shared", "style.css"));
  });

  it("deduplicates by filename across different directories", async () => {
    const path1 = await assets.addFile("dir1/app.js", Buffer.from("code1"));
    const path2 = await assets.addFile("dir2/app.js", Buffer.from("code2"));

    expect(path1).toBe(path2);
  });

  it("writes to _shared/ flat directory", async () => {
    await assets.addFile("main.js", Buffer.from("console.log()"));
    await assets.addFile("style.css", Buffer.from("body{}"));

    const files = await readdir(join(outDir, "_shared"));
    expect(files).toContain("main.js");
    expect(files).toContain("style.css");
  });

  it("writes correct content", async () => {
    const resultPath = await assets.addFile("font.woff2", Buffer.from("font-data"));

    const written = await readFile(resultPath, "utf-8");
    expect(written).toBe("font-data");
  });
});
