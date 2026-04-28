import { mkdtemp, readFile, rm, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { FileSystemReportFiles } from "../src/plugin.js";

describe("FileSystemReportFiles", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    for (const directoryPath of temporaryDirectories) {
      await rm(directoryPath, { recursive: true, force: true });
    }
    temporaryDirectories.length = 0;
  });

  const createWriter = async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "allure-core-plugin-test-"));

    temporaryDirectories.push(outputDirectory);

    return {
      outputDirectory,
      writer: new FileSystemReportFiles(outputDirectory),
    };
  };

  it("uses hardlinks for equal payloads written into different paths", async () => {
    const { writer } = await createWriter();

    const sourcePath = await writer.addFile("report1/main.js", Buffer.from("shared-content", "utf8"));
    const targetPath = await writer.addFile("report2/main.js", Buffer.from("shared-content", "utf8"));
    const sourceStat = await stat(sourcePath);
    const targetStat = await stat(targetPath);

    expect(await readFile(sourcePath, "utf8")).toBe("shared-content");
    expect(await readFile(targetPath, "utf8")).toBe("shared-content");

    if (process.platform !== "win32") {
      expect(sourceStat.ino).toBe(targetStat.ino);
    }
  });

  it("rewrites only a target file when shared link receives a different payload", async () => {
    const { writer } = await createWriter();

    const sourcePath = await writer.addFile("report1/main.css", Buffer.from("same-content", "utf8"));
    const targetPath = await writer.addFile("report2/main.css", Buffer.from("same-content", "utf8"));

    await writer.addFile("report2/main.css", Buffer.from("updated-content", "utf8"));

    expect(await readFile(sourcePath, "utf8")).toBe("same-content");
    expect(await readFile(targetPath, "utf8")).toBe("updated-content");

    if (process.platform !== "win32") {
      const sourceStat = await stat(sourcePath);
      const targetStat = await stat(targetPath);

      expect(sourceStat.ino).not.toBe(targetStat.ino);
    }
  });

  it("falls back to regular write when canonical hardlink source disappears", async () => {
    const { writer } = await createWriter();

    const canonicalPath = await writer.addFile("report1/asset.js", Buffer.from("content-to-share", "utf8"));

    await unlink(canonicalPath);

    const fallbackPath = await writer.addFile("report2/asset.js", Buffer.from("content-to-share", "utf8"));

    expect(await readFile(fallbackPath, "utf8")).toBe("content-to-share");
  });

  it("does not rewrite file when path receives identical content again", async () => {
    const { writer } = await createWriter();

    const targetPath = await writer.addFile("awesome/main.js", Buffer.from("stable-shared-asset", "utf8"));
    const firstStat = await stat(targetPath);

    await writer.addFile("awesome/main.js", Buffer.from("stable-shared-asset", "utf8"));

    if (process.platform !== "win32") {
      const secondStat = await stat(targetPath);

      expect(firstStat.ino).toBe(secondStat.ino);
    }
  });
});
