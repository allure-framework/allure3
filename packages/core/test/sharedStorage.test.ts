import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
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

  const sha256 = (data: Buffer): string => createHash("sha256").update(data).digest("hex");

  describe("CAS deduplication", () => {
    it("returns the same path for identical content written under different names", async () => {
      const data = Buffer.from("duplicate content");
      const path1 = await shared.addFile("a.txt", data);
      const path2 = await shared.addFile("b.txt", data);

      expect(path1).toBe(path2);
    });

    it("creates only one file on disk for identical content", async () => {
      const data = Buffer.from("duplicate content");
      await shared.addFile("a.txt", data);
      await shared.addFile("b.txt", data);

      const files = await readdir(join(outDir, "_shared"));
      expect(files).toHaveLength(1);
    });
  });

  describe("different content", () => {
    it("creates separate CAS entries for different content", async () => {
      const data1 = Buffer.from("content one");
      const data2 = Buffer.from("content two");

      const path1 = await shared.addFile("a.txt", data1);
      const path2 = await shared.addFile("b.txt", data2);

      expect(path1).not.toBe(path2);

      const files = await readdir(join(outDir, "_shared"));
      expect(files).toHaveLength(2);
    });
  });

  describe("extension preservation", () => {
    it("creates separate entries for same content with different extensions", async () => {
      const data = Buffer.from("image-like data");

      const pathPng = await shared.addFile("photo.png", data);
      const pathJpg = await shared.addFile("photo.jpg", data);

      expect(pathPng).not.toBe(pathJpg);
      expect(pathPng).toContain(".png");
      expect(pathJpg).toContain(".jpg");

      const files = await readdir(join(outDir, "_shared"));
      expect(files).toHaveLength(2);
    });

    it("deduplicates when extension and content both match", async () => {
      const data = Buffer.from("same data");
      const path1 = await shared.addFile("first.png", data);
      const path2 = await shared.addFile("second.png", data);

      expect(path1).toBe(path2);
    });
  });

  describe("concurrent writes", () => {
    it("handles simultaneous writes of the same content without duplicates", async () => {
      const data = Buffer.from("concurrent content");

      const results = await Promise.all(Array.from({ length: 10 }, (_, i) => shared.addFile(`file${i}.txt`, data)));

      const unique = new Set(results);
      expect(unique.size).toBe(1);

      const files = await readdir(join(outDir, "_shared"));
      expect(files).toHaveLength(1);
    });

    it("handles simultaneous writes of different content correctly", async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) => shared.addFile(`file${i}.txt`, Buffer.from(`content-${i}`))),
      );

      const unique = new Set(results);
      expect(unique.size).toBe(5);

      const files = await readdir(join(outDir, "_shared"));
      expect(files).toHaveLength(5);
    });
  });

  describe("file written to disk", () => {
    it("writes the correct content to the CAS file", async () => {
      const content = "hello world";
      const data = Buffer.from(content);
      const resultPath = await shared.addFile("greeting.txt", data);

      const written = await readFile(resultPath, "utf-8");
      expect(written).toBe(content);
    });
  });

  describe("returned path", () => {
    it("returns an absolute path", async () => {
      const data = Buffer.from("abs path test");
      const resultPath = await shared.addFile("test.txt", data);

      expect(isAbsolute(resultPath)).toBe(true);
    });

    it("returns a path under _shared/", async () => {
      const data = Buffer.from("shared dir test");
      const resultPath = await shared.addFile("test.txt", data);

      expect(resultPath).toContain("_shared");
      expect(resultPath.startsWith(resolve(outDir, "_shared"))).toBe(true);
    });
  });

  describe("SHA-256 hash correctness", () => {
    it("uses the SHA-256 hash of the content as the filename", async () => {
      const data = Buffer.from("hash me");
      const expectedHash = sha256(data);
      const resultPath = await shared.addFile("original.txt", data);

      const filename = resultPath.split("/").pop()!;
      expect(filename).toBe(`${expectedHash}.txt`);
    });

    it("produces the correct hash for binary content", async () => {
      const data = Buffer.from([0x00, 0xff, 0x80, 0x42]);
      const expectedHash = sha256(data);
      const resultPath = await shared.addFile("binary.bin", data);

      const filename = resultPath.split("/").pop()!;
      expect(filename).toBe(`${expectedHash}.bin`);
    });
  });

  describe("sharedAttachmentsBasePath", () => {
    it("returns ../_shared regardless of pluginId", () => {
      expect(SharedReportFiles.sharedAttachmentsBasePath("awesome")).toBe("../_shared");
      expect(SharedReportFiles.sharedAttachmentsBasePath("other-plugin")).toBe("../_shared");
      expect(SharedReportFiles.sharedAttachmentsBasePath("")).toBe("../_shared");
    });
  });

  describe("nested paths", () => {
    it("uses only the extension from a nested path, not the directory structure", async () => {
      const data = Buffer.from("nested path content");
      const expectedHash = sha256(data);
      const resultPath = await shared.addFile("data/attachments/foo.png", data);

      const filename = resultPath.split("/").pop()!;
      expect(filename).toBe(`${expectedHash}.png`);

      // The file should be directly in _shared/, not in _shared/data/attachments/
      expect(resultPath).toBe(resolve(outDir, "_shared", `${expectedHash}.png`));
    });

    it("deduplicates across nested and flat paths with same content and extension", async () => {
      const data = Buffer.from("dedup nested");
      const path1 = await shared.addFile("deep/nested/file.txt", data);
      const path2 = await shared.addFile("file.txt", data);

      expect(path1).toBe(path2);
    });
  });
});
