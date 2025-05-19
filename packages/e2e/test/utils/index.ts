import { AllureReport, FileSystemReportFiles, type FullConfig } from "@allurereport/core";
import { type HistoryDataPoint } from "@allurereport/core-api";
import { md5 } from "@allurereport/plugin-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { serve } from "@allurereport/static-server";
import type { TestResult } from "allure-js-commons";
import { FileSystemWriter, ReporterRuntime } from "allure-js-commons/sdk/reporter";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export type GeneratorParams = {
  history?: HistoryDataPoint[];
  rootDir: string;
  reportDir: string;
  resultsDir: string;
  testResults: Partial<TestResult>[];
  attachments?: { source: string; content: Buffer }[];
  reportConfig?: Omit<FullConfig, "output" | "reportFiles" | "historyPath">;
};

export interface ReportBootstrap {
  url: string;
  reportDir: string;
  shutdown: () => Promise<void>;
}

export const randomNumber = (min: number, max: number): number => {
  if (min > max) {
    [min, max] = [max, min];
  }

  return Math.floor(Math.random() * (max - min + 1) + min);
};

/**
 * Make simplified test case id from test's full name
 *
 * @param fullName Test case full name
 * @returns Test case id
 */
export const makeTestCaseId = (fullName: string) => md5(fullName);

/**
 * Make simplified history id from test's full name and parameters
 *
 * @param fullName Test case full name
 * @param strParameters Test case parameters
 * @returns History id
 */
export const makeHistoryId = (fullName: string, strParameters = "") => {
  const testCaseId = makeTestCaseId(fullName);
  const parametersMd5 = md5(strParameters);

  return `${testCaseId}.${parametersMd5}`;
};

export const generateReport = async (payload: GeneratorParams) => {
  const { reportConfig, rootDir, reportDir, resultsDir, testResults, attachments = [], history = [] } = payload;
  const historyPath = resolve(rootDir, "history.jsonl");

  if (history.length > 0) {
    await writeFile(historyPath, history.map((item) => JSON.stringify(item)).join("\n"));
  } else {
    await writeFile(historyPath, "");
  }

  const report = new AllureReport({
    ...reportConfig,
    output: reportDir,
    reportFiles: new FileSystemReportFiles(reportDir),
    historyPath,
  });
  const runtime = new ReporterRuntime({
    writer: new FileSystemWriter({
      resultsDir,
    }),
  });
  const scopeUuid = runtime.startScope();

  testResults.forEach((tr) => {
    runtime.writeTest(runtime.startTest(tr, [scopeUuid]));
  });

  for (const attachment of attachments) {
    await writeFile(resolve(resultsDir, attachment.source), attachment.content);
  }

  runtime.writeScope(scopeUuid);

  await report.start();
  await report.readDirectory(resultsDir);
  await report.done();
};

export const serveReport = async (reportDir: string) => {
  const server = await serve({
    servePath: resolve(reportDir),
  });

  return {
    url: `http://localhost:${server.port}`,
    shutdown: async () => {
      await server?.stop();
    },
  };
};

export const bootstrapReport = async (
  params: Omit<GeneratorParams, "rootDir" | "reportDir" | "resultsDir">,
): Promise<ReportBootstrap> => {
  const rootDir = tmpdir();
  const resultsDir = await mkdtemp(resolve(rootDir, "allure-results-"));
  const reportDir = await mkdtemp(resolve(rootDir, "allure-report-"));

  await generateReport({
    ...params,
    rootDir,
    resultsDir,
    reportDir,
  });

  const server = await serveReport(reportDir);

  return {
    ...server,
    reportDir,
    shutdown: async () => {
      await server?.shutdown();

      try {
        await rm(resultsDir, { recursive: true });
        await rm(reportDir, { recursive: true });
      } catch (ignored) {}
    },
  };
};

export class AwesomePluginWithoutSummary extends AwesomePlugin {
  async info() {
    return undefined;
  }
}
