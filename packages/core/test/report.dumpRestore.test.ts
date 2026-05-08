import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { AllureStoreDumpFiles, md5 } from "@allurereport/plugin-api";
import { PathResultFile } from "@allurereport/reader-api";
import { attachment, step } from "allure-js-commons";
import ZipReadStream from "node-stream-zip";
import { afterEach, describe, expect, it, vi } from "vitest";
import ZipWriteStream from "zip-stream";

import { resolveConfig } from "../src/index.js";
import { AllureReport } from "../src/report.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const minimalDumpJsonFiles = (
  overrides: Partial<Record<AllureStoreDumpFiles, string | undefined>> = {},
): Record<string, string> => {
  const files: Record<string, string> = {
    [AllureStoreDumpFiles.TestResults]: "{}",
    [AllureStoreDumpFiles.TestCases]: "{}",
    [AllureStoreDumpFiles.Fixtures]: "{}",
    [AllureStoreDumpFiles.Attachments]: "{}",
    [AllureStoreDumpFiles.CheckResults]: "[]",
    [AllureStoreDumpFiles.Environments]: "[]",
    [AllureStoreDumpFiles.ReportVariables]: "{}",
    [AllureStoreDumpFiles.GlobalAttachments]: "[]",
    [AllureStoreDumpFiles.GlobalErrors]: "[]",
    [AllureStoreDumpFiles.IndexAttachmentsByTestResults]: "{}",
    [AllureStoreDumpFiles.IndexTestResultsByHistoryId]: "{}",
    [AllureStoreDumpFiles.IndexTestResultsByTestCase]: "{}",
    [AllureStoreDumpFiles.IndexLatestEnvTestResultsByHistoryId]: "{}",
    [AllureStoreDumpFiles.IndexAttachmentsByFixture]: "{}",
    [AllureStoreDumpFiles.IndexFixturesByTestResult]: "{}",
    [AllureStoreDumpFiles.IndexKnownByHistoryId]: "{}",
    [AllureStoreDumpFiles.QualityGateResults]: "[]",
  };

  Object.entries(overrides).forEach(([name, value]) => {
    if (value === undefined) {
      delete files[name];
      return;
    }

    files[name] = value;
  });

  return files;
};

const writeZip = async (filePath: string, entries: { name: string; data: Buffer }[]): Promise<void> => {
  const archive = new ZipWriteStream({
    zlib: { level: 5 },
  });
  const stream = createWriteStream(filePath);
  const finished = new Promise<void>((resolvePromise, reject) => {
    archive.on("error", reject);
    stream.on("finish", () => resolvePromise());
    stream.on("error", reject);
  });
  archive.pipe(stream);
  const addEntry = promisify(archive.entry.bind(archive));

  for (const { name, data } of entries) {
    await addEntry(data, { name });
  }

  archive.finalize();
  await finished;
};

const writeDumpZip = async (
  filePath: string,
  attachmentEntries: { name: string; data: Buffer }[],
  jsonFiles: Partial<Record<AllureStoreDumpFiles, string | undefined>> = {},
): Promise<void> => {
  await writeZip(filePath, [
    ...Object.entries(minimalDumpJsonFiles(jsonFiles)).map(([name, body]) => ({
      name,
      data: Buffer.from(body, "utf8"),
    })),
    ...attachmentEntries,
  ]);
};

describe("AllureReport.restoreState (dump zip)", () => {
  const zipPaths: string[] = [];
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(zipPaths.splice(0).map((p) => unlink(p).catch(() => {})));
    await Promise.all(tempDirs.splice(0).map((p) => rm(p, { recursive: true, force: true })));
  });

  const tempZipPath = (): string => {
    const p = join(tmpdir(), `allure-dump-restore-${randomBytes(8).toString("hex")}.zip`);
    zipPaths.push(p);
    return p;
  };

  const tempDir = async (): Promise<string> => {
    const p = await mkdtemp(join(tmpdir(), "allure-dump-restore-"));
    tempDirs.push(p);
    return p;
  };

  it("restores a dump when attachment entry names are safe", async () => {
    const zipPath = tempZipPath();
    await step("write dump archive with a safe attachment entry", async () => {
      await writeDumpZip(zipPath, [{ name: "safe-attachment-id-1", data: Buffer.from("hello") }]);
    });

    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport(config);

    await step("restore a dump with a safe attachment entry", async () => {
      await expect(report.restoreState([zipPath])).resolves.toBeUndefined();
    });
  });

  it("closes the dump archive after restore", async () => {
    const zipPath = tempZipPath();
    const closeSpy = vi.spyOn(ZipReadStream.async.prototype, "close");
    await writeDumpZip(zipPath, [{ name: "safe-attachment-id-1", data: Buffer.from("hello") }]);

    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport(config);

    await step("restore a dump and release the archive handle", async () => {
      await expect(report.restoreState([zipPath])).resolves.toBeUndefined();

      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("restores check results from a dump", async () => {
    const zipPath = tempZipPath();
    const checkResults = [
      {
        name: "Lint",
        status: "passed",
        tags: ["ci"],
        details: {
          command: "npm run lint",
          message: "lint ok",
        },
      },
    ];

    await writeDumpZip(zipPath, [], {
      [AllureStoreDumpFiles.CheckResults]: JSON.stringify(checkResults),
    });

    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport(config);

    await step("restore check results from a dump archive", async () => {
      await report.restoreState([zipPath]);

      await expect(report.store.allCheckResults()).resolves.toEqual(checkResults);
    });
  });

  it("restores legacy dumps without check results metadata", async () => {
    const zipPath = tempZipPath();

    await writeDumpZip(zipPath, [], {
      [AllureStoreDumpFiles.CheckResults]: undefined,
    });

    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport(config);

    await step("restore a dump archive without check-results.json", async () => {
      await report.restoreState([zipPath]);

      await expect(report.store.allCheckResults()).resolves.toEqual([]);
    });
  });

  it("restores a dump nested inside a downloaded artifact archive", async () => {
    const nestedZipPath = tempZipPath();
    const outerZipPath = tempZipPath();

    await writeDumpZip(nestedZipPath, [], {
      [AllureStoreDumpFiles.CheckResults]: undefined,
    });
    await writeZip(outerZipPath, [
      {
        name: "allure-results-macos-latest.zip",
        data: await readFile(nestedZipPath),
      },
    ]);

    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport(config);

    await step("restore a dump from a nested artifact zip", async () => {
      await report.restoreState([outerZipPath]);

      await expect(report.store.allCheckResults()).resolves.toEqual([]);
    });
  });

  it("ignores archive entries that are not declared as attachments", async () => {
    const zipPath = tempZipPath();
    const attachmentId = "safe-attachment-id-1";

    await writeDumpZip(
      zipPath,
      [
        { name: `__MACOSX/._${attachmentId}`, data: Buffer.from("resource fork") },
        { name: attachmentId, data: Buffer.from("hello") },
      ],
      {
        [AllureStoreDumpFiles.Attachments]: JSON.stringify({
          [attachmentId]: {
            id: attachmentId,
            originalFileName: "attachment.txt",
            contentType: "text/plain",
            ext: ".txt",
            used: true,
          },
        }),
      },
    );

    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport(config);

    await step("restore only declared attachment entries", async () => {
      await report.restoreState([zipPath]);

      const restoredAttachmentContent = await report.store.attachmentContentById(attachmentId);

      expect(restoredAttachmentContent).toBeDefined();
      await expect(restoredAttachmentContent!.asBuffer()).resolves.toEqual(Buffer.from("hello"));
    });
  });

  it("does not restore attachment payload entries marked missed in dump metadata", async () => {
    const zipPath = tempZipPath();
    const attachmentId = "missed-attachment-id";
    await writeDumpZip(zipPath, [{ name: attachmentId, data: Buffer.from("stale payload") }], {
      [AllureStoreDumpFiles.Attachments]: JSON.stringify({
        [attachmentId]: {
          id: attachmentId,
          originalFileName: "missing-attachment.txt",
          contentType: "text/plain",
          ext: ".txt",
          missed: true,
          used: true,
        },
      }),
    });

    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport(config);

    await step("restore a dump with a stale payload for a missed attachment", async () => {
      await expect(report.restoreState([zipPath])).resolves.toBeUndefined();

      const restoredAttachment = await report.store.attachmentById(attachmentId);
      const restoredAttachmentContent = await report.store.attachmentContentById(attachmentId);

      expect(restoredAttachment).toMatchObject({
        id: attachmentId,
        originalFileName: "missing-attachment.txt",
        missed: true,
        used: true,
      });
      expect(restoredAttachmentContent).toBeUndefined();
    });
  });

  it("finalizes a dump when an indexed attachment source disappears before dump writing", async () => {
    const dir = await tempDir();
    const dumpPath = join(dir, "dump");
    const attachmentFileName = "7bd0d1b7-0211-4c1a-84a0-944694ce1d89-attachment.txt";
    const attachmentPath = join(dir, attachmentFileName);
    const attachmentId = md5(attachmentFileName);
    const config = await resolveConfig({
      name: "Allure Report",
      output: join(dir, "report"),
    });
    const report = new AllureReport({
      ...config,
      dump: dumpPath,
    });

    await step("prepare a linked attachment source", async () => {
      await writeFile(attachmentPath, JSON.stringify({ uuid: "nested-test-result" }), "utf8");
      await report.start();
      await report.store.visitAttachmentFile(new PathResultFile(attachmentPath, attachmentFileName));
      await report.store.visitTestResult(
        {
          uuid: "test-result-id",
          name: "test result with disappearing attachment",
          fullName: "test result with disappearing attachment",
          status: "passed",
          steps: [
            {
              name: "nested test result",
              originalFileName: attachmentFileName,
              contentType: "text/plain",
              type: "attachment",
            },
          ],
        },
        { readerId: "report.dumpRestore.test.ts" },
      );
      await attachment(
        "indexed attachment before removal",
        JSON.stringify(
          {
            attachmentId,
            attachmentFileName,
            attachmentPath,
          },
          null,
          2,
        ),
        "application/json",
      );
      await unlink(attachmentPath);
    });

    await step("write the dump after the attachment source is removed", async () => {
      await expect(report.done()).resolves.toBeUndefined();
    });

    const restoredReport = new AllureReport(config);

    await step("restore the finalized dump and verify missed attachment metadata", async () => {
      await expect(restoredReport.restoreState([`${dumpPath}.zip`])).resolves.toBeUndefined();

      const restoredAttachment = await restoredReport.store.attachmentById(attachmentId);
      const restoredAttachmentContent = await restoredReport.store.attachmentContentById(attachmentId);

      expect(restoredAttachment).toMatchObject({
        id: attachmentId,
        originalFileName: attachmentFileName,
        missed: true,
        used: true,
      });
      expect(restoredAttachment).not.toHaveProperty("contentLength");
      expect(restoredAttachmentContent).toBeUndefined();
      await attachment(
        "restored missed attachment metadata",
        JSON.stringify(
          {
            restoredAttachment,
            hasContent: restoredAttachmentContent !== undefined,
          },
          null,
          2,
        ),
        "application/json",
      );
    });
  });

  it("finalizes a dump when adding an attachment entry fails", async () => {
    const dir = await tempDir();
    const dumpPath = join(dir, "dump");
    const attachmentFileName = "attachment-entry-write-error.txt";
    const attachmentPath = join(dir, attachmentFileName);
    const attachmentId = md5(attachmentFileName);
    const config = await resolveConfig({
      name: "Allure Report",
      output: join(dir, "report"),
    });
    const report = new AllureReport({
      ...config,
      dump: dumpPath,
    });
    const originalEntry = ZipWriteStream.prototype.entry;

    vi.spyOn(ZipWriteStream.prototype, "entry").mockImplementation(function (
      this: ZipWriteStream,
      source: Parameters<typeof originalEntry>[0],
      data: Parameters<typeof originalEntry>[1],
      callback: Parameters<typeof originalEntry>[2],
    ) {
      if (data.name === attachmentId) {
        callback?.(new Error("zip entry write failed"));
        return this;
      }

      return originalEntry.call(this, source, data, callback);
    });

    await step("prepare a linked attachment source", async () => {
      await writeFile(attachmentPath, "attachment body", "utf8");
      await report.start();
      await report.store.visitAttachmentFile(new PathResultFile(attachmentPath, attachmentFileName));
      await report.store.visitTestResult(
        {
          uuid: "test-result-with-entry-error",
          name: "test result with attachment entry write error",
          fullName: "test result with attachment entry write error",
          status: "passed",
          steps: [
            {
              name: "attachment with failed dump entry",
              originalFileName: attachmentFileName,
              contentType: "text/plain",
              type: "attachment",
            },
          ],
        },
        { readerId: "report.dumpRestore.test.ts" },
      );
      await attachment(
        "attachment entry failure setup",
        JSON.stringify(
          {
            attachmentId,
            attachmentFileName,
            attachmentPath,
          },
          null,
          2,
        ),
        "application/json",
      );
    });

    await step("write and restore the dump", async () => {
      await expect(report.done()).resolves.toBeUndefined();

      const restoredReport = new AllureReport(config);

      await expect(restoredReport.restoreState([`${dumpPath}.zip`])).resolves.toBeUndefined();

      const restoredAttachment = await restoredReport.store.attachmentById(attachmentId);
      const restoredAttachmentContent = await restoredReport.store.attachmentContentById(attachmentId);

      expect(restoredAttachment).toMatchObject({
        id: attachmentId,
        originalFileName: attachmentFileName,
        missed: true,
        used: true,
      });
      expect(restoredAttachment).not.toHaveProperty("contentLength");
      expect(restoredAttachmentContent).toBeUndefined();
    });
  });

  it("does not leave the final dump file when a required metadata entry fails", async () => {
    const dir = await tempDir();
    const dumpPath = join(dir, "dump");
    const config = await resolveConfig({
      name: "Allure Report",
      output: join(dir, "report"),
    });
    const report = new AllureReport({
      ...config,
      dump: dumpPath,
    });
    const originalEntry = ZipWriteStream.prototype.entry;

    vi.spyOn(ZipWriteStream.prototype, "entry").mockImplementation(function (
      this: ZipWriteStream,
      source: Parameters<typeof originalEntry>[0],
      data: Parameters<typeof originalEntry>[1],
      callback: Parameters<typeof originalEntry>[2],
    ) {
      if (data.name === AllureStoreDumpFiles.TestResults) {
        callback?.(new Error("metadata entry write failed"));
        return this;
      }

      return originalEntry.call(this, source, data, callback);
    });

    await report.start();

    await step("reject the dump without publishing the final zip", async () => {
      await expect(report.done()).rejects.toThrow(
        `Failed to write dump entry "${AllureStoreDumpFiles.TestResults}": metadata entry write failed`,
      );
      expect(existsSync(`${dumpPath}.zip`)).toBe(false);
    });
  });

  it("writes check results to a dump", async () => {
    const dumpPath = join(tmpdir(), `allure-check-dump-${randomBytes(8).toString("hex")}`);
    const zipPath = `${dumpPath}.zip`;
    const checkResult = {
      name: "Lint",
      status: "passed" as const,
      tags: ["ci"],
      details: {
        command: "npm run lint",
        message: "lint ok",
      },
    };

    zipPaths.push(zipPath);

    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport({
      ...config,
      dump: dumpPath,
      plugins: [],
    });

    await report.start();
    await report.store.addCheckResult(checkResult);
    await report.done();

    const archive = new ZipReadStream.async({
      file: zipPath,
    });

    try {
      const checkResultsEntry = await archive.entryData(AllureStoreDumpFiles.CheckResults);

      expect(JSON.parse(checkResultsEntry.toString("utf8"))).toEqual([checkResult]);
    } finally {
      await archive.close();
    }
  });
});

describe("AllureReport.restoreState (zip path validation layers)", () => {
  it("refuses archives that contain path-traversal entry names (node-stream-zip)", async () => {
    const zipPath = join(__dirname, "fixtures", "dump-with-zip-slip-entry.zip");
    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport(config);

    await expect(report.restoreState([zipPath])).rejects.toThrow(/Malicious entry/);
  });
});
