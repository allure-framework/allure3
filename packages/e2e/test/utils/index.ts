import { AllureReport, FileSystemReportFiles, type FullConfig } from "@allurereport/core";
import AllureAwesomePlugin from "@allurereport/plugin-awesome";
import { serve } from "@allurereport/static-server";
import { type TestResult, parameter } from "allure-js-commons";
import { FileSystemWriter, ReporterRuntime } from "allure-js-commons/sdk/reporter";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { env } from "node:process";

const { ALLURE_SINGLE_FILE } = env;

export type GeneratorParams = {
  reportDir: string;
  resultsDir: string;
  testResults: Partial<TestResult>[];
  reportConfig?: Omit<FullConfig, "output" | "reportFiles">;
  pluginConfig?: any;
};

export interface ReportBootstrap {
  url: string;
  servePath: string;
  shutdown: () => Promise<void>;
}

export const setEnvParameters = async () => {
  await parameter("singleFile", String(Boolean(ALLURE_SINGLE_FILE)));
};

export const randomNumber = (min: number, max: number) => {
  if (min > max) {
    [min, max] = [max, min];
  }

  return Math.random() * (max - min) + min;
};

export const generateTestResults = async (payload: GeneratorParams) => {
  const { reportConfig, reportDir, resultsDir, pluginConfig, testResults } = payload;
  const report = new AllureReport({
    plugins: [
      {
        id: "awesome",
        enabled: true,
        plugin: new AllureAwesomePlugin({
          singleFile: Boolean(ALLURE_SINGLE_FILE),
          ...pluginConfig,
        }),
        options: {},
      },
    ],
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

export const boostrapReport = async (
  params: Omit<GeneratorParams, "reportDir" | "resultsDir">,
): Promise<ReportBootstrap> => {
  const temp = tmpdir();
  const allureTestResultsDir = await mkdtemp(resolve(temp, "allure-results-"));
  const allureReportDir = await mkdtemp(resolve(temp, "allure-report-"));

  await generateTestResults({
    ...params,
    resultsDir: allureTestResultsDir,
    reportDir: allureReportDir,
  });

  const servePath = resolve(allureReportDir, "./awesome");
  const server = await serve({
    servePath,
  });

  return {
    url: `http://localhost:${server.port}`,
    servePath,
    shutdown: async () => {
      await server?.stop();

      try {
        await rm(allureTestResultsDir, { recursive: true });
        await rm(allureReportDir, { recursive: true });
      } catch (ignored) {}
    },
  };
};
