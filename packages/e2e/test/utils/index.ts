import { AllureReport, FileSystemReportFiles, type FullConfig } from "@allurereport/core";
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
  reportDir: string;
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

  await generateReport({
    ...params,
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
