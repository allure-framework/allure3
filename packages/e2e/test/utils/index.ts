import { AllureReport, FileSystemReportFiles, type FullConfig } from "@allurereport/core";
import { md5 } from "@allurereport/plugin-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { serve } from "@allurereport/static-server";
import type { TestResult } from "allure-js-commons";
import { FileSystemWriter, ReporterRuntime } from "allure-js-commons/sdk/reporter";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export type GeneratorParams = {
  reportDir: string;
  resultsDir: string;
  testResults: Partial<TestResult>[];
  attachments?: { source: string; content: Buffer }[];
  reportConfig?: Omit<FullConfig, "output" | "reportFiles">;
};

export interface ReportBootstrap {
  url: string;
  reportDir: string;
  regenerate: () => Promise<void>;
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
 * @param parameters Test case parameters
 * @returns History id
 */
export const makeHistoryId = (fullName: string, strParameters = "") => {
  const testCaseId = makeTestCaseId(fullName);
  const parametersMd5 = md5(strParameters);

  return `${testCaseId}.${parametersMd5}`;
};

export const generateReport = async (payload: GeneratorParams) => {
  const { reportConfig, reportDir, resultsDir, testResults, attachments = [] } = payload;
  const report = new AllureReport({
    ...reportConfig,
    output: reportDir,
    reportFiles: new FileSystemReportFiles(reportDir),
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
  params: Omit<GeneratorParams, "reportDir" | "resultsDir">,
): Promise<ReportBootstrap> => {
  const temp = tmpdir();
  const resultsDir = await mkdtemp(resolve(temp, "allure-results-"));
  const reportDir = await mkdtemp(resolve(temp, "allure-report-"));
  const reportGenerator = async () => {
    await generateReport({
      ...params,
      resultsDir,
      reportDir,
    });
  };

  await reportGenerator();

  const server = await serveReport(reportDir);

  return {
    ...server,
    reportDir,
    regenerate: reportGenerator,
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
