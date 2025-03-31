import {
  AllureReport,
  FileSystemReportFiles,
  type FullConfig,
} from "@allurereport/core";
import { serve } from "@allurereport/static-server";
import { type TestResult } from "allure-js-commons";
import { FileSystemWriter, ReporterRuntime } from "allure-js-commons/sdk/reporter";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export type GeneratorParams = {
  reportDir: string;
  resultsDir: string;
  testResults: Partial<TestResult>[];
  reportConfig?: Omit<FullConfig, "output" | "reportFiles">;
};

export interface ReportBootstrap {
  url: string;
  shutdown: () => Promise<void>;
}

export const randomNumber = (min: number, max: number) => {
  if (min > max) {
    [min, max] = [max, min];
  }

  return Math.random() * (max - min) + min;
};

export const generateReport = async (payload: GeneratorParams) => {
  const { reportConfig, reportDir, resultsDir, testResults } = payload;
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
  runtime.writeScope(scopeUuid);

  await report.start();
  await report.readDirectory(resultsDir);
  await report.done();
};

export const bootstrapReport = async (
  params: Omit<GeneratorParams, "reportDir" | "resultsDir">,
): Promise<ReportBootstrap> => {
  const temp = tmpdir();
  const allureTestResultsDir = await mkdtemp(resolve(temp, "allure-results-"));
  const allureReportDir = await mkdtemp(resolve(temp, "allure-report-"));

  await generateReport({
    ...params,
    resultsDir: allureTestResultsDir,
    reportDir: allureReportDir,
  });

  const server = await serve({
    servePath: resolve(allureReportDir, "./awesome"),
  });

  return {
    url: `http://localhost:${server.port}`,
    shutdown: async () => {
      await server?.stop();

      try {
        await rm(allureTestResultsDir, { recursive: true });
        await rm(allureReportDir, { recursive: true });
      } catch (ignored) {}
    },
  };
};
