import { ResultFile } from "@allurereport/plugin-api";
import { PathResultFile, ResultsReader, ResultsVisitor } from "@allurereport/reader-api";
import { attachment, step } from "allure-js-commons";
import { existsSync } from "fs";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Mocked, expect, vi } from "vitest";

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
});

export const readResults = async (reader: ResultsReader, files: Record<string, string> = {}) => {
  return step("readResults", async () => {
    const visitor = mockVisitor();
    for (const filesKey in files) {
      const resultFile = await readResourceAsResultFile(filesKey, files[filesKey]);
      await attachResultFile(resultFile);
      const read = await reader.read(visitor, resultFile);
      expect(read).toBe(true);
    }
    return visitor;
  });
};

export const attachResultFile = async (resultFile: ResultFile) => {
  const content = await resultFile.asBuffer();
  if (content) {
    await attachment(resultFile.getOriginalFileName(), content, resultFile.getContentType() ?? "text/plain");
  }
};