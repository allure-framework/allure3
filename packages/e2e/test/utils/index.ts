import { AllureReport, FileSystemReportFiles, type FullConfig } from "@allurereport/core";
import { type HistoryDataPoint, type TestError } from "@allurereport/core-api";
import { type ExitCode } from "@allurereport/plugin-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { BufferResultFile } from "@allurereport/reader-api";
import { serve } from "@allurereport/static-server";
import type { TestResult } from "allure-js-commons";
import { FileSystemWriter, ReporterRuntime } from "allure-js-commons/sdk/reporter";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export type GeneratorParams = {
  history?: HistoryDataPoint[];
  rootDir: string;
  reportDir: string;
  resultsDir: string;
  testResults?: Partial<TestResult>[];
  rawTestResults?: Partial<TestResult>[];
  attachments?: { source: string; content: Buffer }[];
  reportConfig?: Omit<FullConfig, "output" | "reportFiles" | "historyPath">;
  globals?: {
    exitCode?: ExitCode;
    errors?: TestError[];
    attachments?: Record<string, Buffer>;
  };
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

export const generateReport = async (payload: GeneratorParams) => {
  const {
    reportConfig,
    rootDir,
    reportDir,
    resultsDir,
    testResults = [],
    rawTestResults = [],
    attachments = [],
    history = [],
    globals,
  } = payload;
  const hasHistory = history.length > 0;
  const historyPath = resolve(rootDir, `history-${randomUUID()}.jsonl`);

  if (!existsSync(historyPath)) {
    await writeFile(historyPath, "");
  }

  if (hasHistory) {
    await writeFile(historyPath, history.map((item) => JSON.stringify(item)).join("\n"), { encoding: "utf-8" });
  }

  const report = new AllureReport({
    ...reportConfig,
    output: reportDir,
    reportFiles: new FileSystemReportFiles(reportDir),
    historyPath: hasHistory ? historyPath : undefined,
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

  for (const tr of rawTestResults) {
    await writeFile(resolve(resultsDir, `${randomUUID()}-result.json`), JSON.stringify(tr));
  }

  for (const attachment of attachments) {
    await writeFile(resolve(resultsDir, attachment.source), attachment.content);
  }

  runtime.writeScope(scopeUuid);

  await report.start();

  if (globals) {
    if (globals.exitCode) {
      report.realtimeDispatcher.sendGlobalExitCode(globals.exitCode);
    }

    if (globals.errors) {
      globals.errors.forEach((error) => {
        report.realtimeDispatcher.sendGlobalError(error);
      });
    }

    if (globals.attachments) {
      Object.entries(globals.attachments).forEach(([fileName, buffer]) => {
        const resultFile = new BufferResultFile(buffer, fileName);

        report.realtimeDispatcher.sendGlobalAttachment(resultFile);
      });
    }
  }

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
  const reportGenerator = async () => {
    await generateReport({
      ...params,
      rootDir,
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

/**
 * 2. Release
 * 3. GH Actions permissions
 * 4. Plan for next two weeks
 */
