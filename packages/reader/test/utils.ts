import { existsSync } from "fs";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Writable } from "node:stream";

import type { ResultFile } from "@allurereport/plugin-api";
import { PathResultFile, type ResultsReader, type ResultsVisitor } from "@allurereport/reader-api";
import { attachment, step } from "allure-js-commons";
import archiver from "archiver";
import { type Mocked, expect, vi } from "vitest";

export const buildResourcePath = (path: string) => resolve(__dirname, "./resources", path);

export const readResourceAsJson = async <T>(path: string) => {
  const resourcePath = buildResourcePath(path);
  const resourceContent = await readFile(resourcePath, "utf-8");

  return JSON.parse(resourceContent) as T;
};
export const readResourceAsResultFile = async (path: string, filename?: string) => {
  const resourcePath = buildResourcePath(path);

  if (!existsSync(resourcePath)) {
    throw new Error(`Resource file ${resourcePath} not found`);
  }

  return new PathResultFile(resourcePath, filename || basename(path));
};

export const mockVisitor: () => Mocked<ResultsVisitor> = () => ({
  visitTestResult: vi.fn<ResultsVisitor["visitTestResult"]>(),
  visitAttachmentFile: vi.fn<ResultsVisitor["visitAttachmentFile"]>(),
  visitMetadata: vi.fn<ResultsVisitor["visitMetadata"]>(),
  visitTestFixtureResult: vi.fn<ResultsVisitor["visitTestFixtureResult"]>(),
  visitGlobals: vi.fn<ResultsVisitor["visitGlobals"]>(),
});

export const readResults = async (
  reader: ResultsReader,
  files: Record<string, string> = {},
  result: boolean = true,
) => {
  return step(`read ${reader.readerId()} results`, async () => {
    const visitor = mockVisitor();

    await attachment(
      `${reader.readerId()}-inputs.json`,
      Buffer.from(
        JSON.stringify(
          {
            readerId: reader.readerId(),
            expectedResult: result,
            files: Object.entries(files).map(([resourcePath, originalFileName]) => ({
              resourcePath,
              originalFileName,
            })),
          },
          null,
          2,
        ),
        "utf-8",
      ),
      "application/json",
    );

    for (const filesKey in files) {
      await step(`read ${filesKey}`, async () => {
        const resultFile = await readResourceAsResultFile(filesKey, files[filesKey]);
        await attachResultFile(resultFile);
        const read = await reader.read(visitor, resultFile);
        expect(read).toBe(result);
      });
    }

    await attachment(
      `${reader.readerId()}-visitor-summary.json`,
      Buffer.from(
        JSON.stringify(
          {
            testResults: visitor.visitTestResult.mock.calls.length,
            attachmentFiles: visitor.visitAttachmentFile.mock.calls.length,
            metadata: visitor.visitMetadata.mock.calls.length,
            fixtures: visitor.visitTestFixtureResult.mock.calls.length,
            globals: visitor.visitGlobals.mock.calls.length,
          },
          null,
          2,
        ),
        "utf-8",
      ),
      "application/json",
    );

    return visitor;
  });
};

export const attachResultFile = async (resultFile: ResultFile) => {
  const content = await resultFile.asBuffer();

  if (content) {
    await attachment(resultFile.getOriginalFileName(), content, resultFile.getContentType() ?? "text/plain");
  }
};

export const attachResultDir = async (resultDir: string) => {
  const compressedFolder = await zipFolder(resultDir);
  await attachment(`${basename(resultDir)}.zip`, compressedFolder, "application/zip");
};

export const zipFolder = async (dirPath: string) => {
  const chunks: Uint8Array[] = [];

  // see https://nodejs.org/api/stream.html#implementing-a-writable-stream
  const writable = new Writable();
  // eslint-disable-next-line no-underscore-dangle
  writable._write = (chunk: Uint8Array, encoding, callback) => {
    chunks.push(chunk);
    callback();
  };

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(writable);
  archive.directory(dirPath, basename(dirPath));
  await archive.finalize();

  return Buffer.concat(chunks);
};
