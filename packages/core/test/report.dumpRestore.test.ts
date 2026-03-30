import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { AllureStoreDumpFiles } from "@allurereport/plugin-api";
import { afterEach, describe, expect, it } from "vitest";
import ZipWriteStream from "zip-stream";

import { resolveConfig } from "../src/index.js";
import { AllureReport } from "../src/report.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const minimalDumpJsonFiles = (): Record<string, string> => ({
  [AllureStoreDumpFiles.TestResults]: "{}",
  [AllureStoreDumpFiles.TestCases]: "{}",
  [AllureStoreDumpFiles.Fixtures]: "{}",
  [AllureStoreDumpFiles.Attachments]: "{}",
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
});

const writeDumpZip = async (filePath: string, attachmentEntries: { name: string; data: Buffer }[]): Promise<void> => {
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

  for (const [name, body] of Object.entries(minimalDumpJsonFiles())) {
    await addEntry(Buffer.from(body, "utf8"), { name });
  }
  for (const { name, data } of attachmentEntries) {
    await addEntry(data, { name });
  }
  archive.finalize();
  await finished;
};

describe("AllureReport.restoreState (dump zip)", () => {
  const zipPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(zipPaths.splice(0).map((p) => unlink(p).catch(() => {})));
  });

  const tempZipPath = (): string => {
    const p = join(tmpdir(), `allure-dump-restore-${randomBytes(8).toString("hex")}.zip`);
    zipPaths.push(p);
    return p;
  };

  it("restores a dump when attachment entry names are safe", async () => {
    const zipPath = tempZipPath();
    await writeDumpZip(zipPath, [{ name: "safe-attachment-id-1", data: Buffer.from("hello") }]);

    const config = await resolveConfig({ name: "Allure Report" });
    const report = new AllureReport(config);

    await expect(report.restoreState([zipPath])).resolves.toBeUndefined();
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
