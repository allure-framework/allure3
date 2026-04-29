import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { AllureReport, QualityGateState, stringifyQualityGateResults } from "@allurereport/core";
import { type KnownTestFailure, createTestPlan } from "@allurereport/core-api";
import type { Watcher } from "@allurereport/directory-watcher";
import {
  allureResultsDirectoriesWatcher,
  delayedFileProcessingWatcher,
  newFilesInDirectoryWatcher,
} from "@allurereport/directory-watcher";
import type { ExitCode, QualityGateValidationResult } from "@allurereport/plugin-api";
import { BufferResultFile, PathResultFile } from "@allurereport/reader-api";
import { KnownError } from "@allurereport/service";
import { red } from "yoctocolors";

import { logTests, runProcess, terminationOf } from "../../utils/index.js";
import { logError } from "../../utils/logs.js";
import { stopProcessTree } from "../../utils/process.js";

export type TestProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  qualityGateResults: QualityGateValidationResult[];
};

export type RunLogsMode = "pipe" | "inherit" | "ignore";

export const executeNestedAllureCommand = async (params: {
  command: string;
  commandArgs: string[];
  cwd: string;
  environmentVariables?: Record<string, string>;
  silent?: boolean;
}): Promise<number | null> => {
  const nestedProcess = runProcess({
    command: params.command,
    commandArgs: params.commandArgs,
    cwd: params.cwd,
    environmentVariables: params.environmentVariables,
    logs: params.silent ? "ignore" : "inherit",
  });

  const { code } = await terminationOf(nestedProcess);

  return code;
};

export const runTests = async (params: {
  allureReport: AllureReport;
  knownIssues: KnownTestFailure[];
  cwd: string;
  command: string;
  commandArgs: string[];
  environmentVariables: Record<string, string>;
  environment?: string;
  withQualityGate: boolean;
  silent?: boolean;
  logs?: RunLogsMode;
  logProcessExit?: boolean;
}): Promise<TestProcessResult | null> => {
  const {
    allureReport,
    knownIssues,
    cwd,
    command,
    commandArgs,
    logs,
    environmentVariables,
    environment,
    withQualityGate,
    silent,
    logProcessExit = true,
  } = params;
  let testProcessStarted = false;
  const allureResultsWatchers: Map<string, Watcher> = new Map();
  const processWatcher = delayedFileProcessingWatcher(
    async (path) => {
      await allureReport.readResult(new PathResultFile(path));
    },
    {
      indexDelay: 200,
      minProcessingDelay: 1_000,
    },
  );
  const allureResultsWatch = allureResultsDirectoriesWatcher(
    cwd,
    async (newAllureResults, deletedAllureResults) => {
      for (const delAr of deletedAllureResults) {
        const watcher = allureResultsWatchers.get(delAr);

        if (watcher) {
          await watcher.abort();
        }

        allureResultsWatchers.delete(delAr);
      }

      for (const newAr of newAllureResults) {
        if (allureResultsWatchers.has(newAr)) {
          continue;
        }

        const watcher = newFilesInDirectoryWatcher(
          newAr,
          async (path) => {
            await processWatcher.addFile(path);
          },
          {
            // the initial scan is preformed before we start the test process.
            // all the watchers created before the test process
            // should ignore initial results.
            ignoreInitial: !testProcessStarted,
            indexDelay: 300,
          },
        );

        allureResultsWatchers.set(newAr, watcher);

        await watcher.initialScan();
      }
    },
    { indexDelay: 600 },
  );

  await allureResultsWatch.initialScan();

  testProcessStarted = true;

  const beforeProcess = Date.now();
  const testProcess = runProcess({
    command,
    commandArgs,
    cwd,
    environmentVariables,
    logs,
  });
  const qualityGateState = new QualityGateState();
  let qualityGateUnsub: ReturnType<typeof allureReport.realtimeSubscriber.onTestResults> | undefined;
  let qualityGateResults: QualityGateValidationResult[] = [];
  let testProcessStdout = "";
  let testProcessStderr = "";

  if (withQualityGate) {
    qualityGateUnsub = allureReport.realtimeSubscriber.onTestResults(async (testResults) => {
      const trs = await Promise.all(testResults.map((tr) => allureReport.store.testResultById(tr)));
      const filteredTrs = trs.filter((tr) => tr !== undefined);

      if (!filteredTrs.length) {
        return;
      }

      const { results, fastFailed } = await allureReport.validate({
        trs: filteredTrs,
        state: qualityGateState,
        environment,
        knownIssues,
      });

      // process only fast-failed checks here
      if (!fastFailed) {
        return;
      }

      allureReport.realtimeDispatcher.sendQualityGateResults(results);
      qualityGateResults = results;

      try {
        await stopProcessTree(testProcess.pid!);
      } catch (err) {
        if ((err as Error).message.includes("kill ESRCH")) {
          return;
        }

        throw err;
      }
    });
  }

  if (logs === "pipe") {
    testProcess.stdout?.setEncoding("utf8").on?.("data", (data: string) => {
      testProcessStdout += data;

      if (silent) {
        return;
      }

      process.stdout.write(data);
    });
    testProcess.stderr?.setEncoding("utf8").on?.("data", async (data: string) => {
      testProcessStderr += data;

      if (silent) {
        return;
      }

      process.stderr.write(data);
    });
  }

  const { code, error } = await terminationOf(testProcess);
  const afterProcess = Date.now();

  if (logProcessExit) {
    if (error) {
      console.log(`process failed to start: ${error.message} (${afterProcess - beforeProcess}ms)`);
    } else if (code !== null) {
      console.log(`process finished with code ${code} (${afterProcess - beforeProcess}ms)`);
    } else {
      console.log(`process terminated (${afterProcess - beforeProcess}ms)`);
    }
  }

  if (error && !testProcessStderr.includes(error.message)) {
    testProcessStderr = [testProcessStderr, error.message].filter(Boolean).join("\n");
  }

  await allureResultsWatch.abort();

  for (const [ar, watcher] of allureResultsWatchers) {
    await watcher.abort();

    allureResultsWatchers.delete(ar);
  }

  await processWatcher.abort();

  qualityGateUnsub?.();

  return {
    code,
    stdout: testProcessStdout,
    stderr: testProcessStderr,
    qualityGateResults,
  };
};

export const executeAllureRun = async (params: {
  allureReport: AllureReport;
  knownIssues: KnownTestFailure[];
  cwd: string;
  command: string;
  commandArgs: string[];
  environmentVariables?: Record<string, string>;
  environment?: string;
  withQualityGate: boolean;
  silent?: boolean;
  logs?: RunLogsMode;
  ignoreLogs?: boolean;
  maxRerun?: number;
  logProcessExit?: boolean;
}): Promise<{
  globalExitCode: ExitCode;
  testProcessResult: TestProcessResult | null;
}> => {
  const {
    allureReport,
    knownIssues,
    cwd,
    command,
    commandArgs,
    environmentVariables = {},
    environment,
    withQualityGate,
    silent,
    logs,
    ignoreLogs,
    maxRerun = 0,
    logProcessExit = true,
  } = params;
  await allureReport.start();

  const globalExitCode: ExitCode = {
    original: 0,
    actual: undefined,
  };
  let qualityGateResults: QualityGateValidationResult[] = [];
  let testProcessResult: TestProcessResult | null = null;

  try {
    testProcessResult = await runTests({
      logs,
      silent,
      allureReport,
      knownIssues,
      cwd,
      command,
      commandArgs,
      environment,
      environmentVariables,
      withQualityGate,
      logProcessExit,
    });

    for (let rerun = 0; rerun < maxRerun; rerun++) {
      const failed = await allureReport.store.failedTestResults();

      if (failed.length === 0) {
        console.log("no failed tests is detected.");
        break;
      }

      const testPlan = createTestPlan(failed);

      console.log(`rerun number ${rerun} of ${testPlan.tests.length} tests:`);
      logTests(failed);

      const tmpDir = await mkdtemp(join(tmpdir(), "allure-run-"));
      const testPlanPath = resolve(tmpDir, `${rerun}-testplan.json`);

      await writeFile(testPlanPath, JSON.stringify(testPlan));

      testProcessResult = await runTests({
        silent,
        logs,
        allureReport,
        knownIssues,
        cwd,
        command,
        commandArgs,
        environment,
        environmentVariables: {
          ...environmentVariables,
          ALLURE_TESTPLAN_PATH: testPlanPath,
          ALLURE_RERUN: `${rerun}`,
        },
        withQualityGate,
        logProcessExit,
      });

      await rm(tmpDir, { recursive: true });

      logTests(await allureReport.store.allTestResults());
    }

    const trs = await allureReport.store.allTestResults({ includeHidden: false });
    qualityGateResults = testProcessResult?.qualityGateResults ?? [];

    if (withQualityGate && !qualityGateResults.length) {
      const { results } = await allureReport.validate({
        trs,
        knownIssues,
        environment,
      });

      qualityGateResults = results;
    }

    if (qualityGateResults.length) {
      const qualityGateMessage = stringifyQualityGateResults(qualityGateResults);

      console.error(qualityGateMessage);

      allureReport.realtimeDispatcher.sendQualityGateResults(qualityGateResults);
    }

    globalExitCode.original = testProcessResult?.code ?? -1;

    if (withQualityGate) {
      globalExitCode.actual = qualityGateResults.length > 0 ? 1 : 0;
    }
  } catch (error) {
    globalExitCode.actual = 1;

    if (error instanceof KnownError) {
      // eslint-disable-next-line no-console
      console.error(red(error.message));

      allureReport.realtimeDispatcher.sendGlobalError({
        message: error.message,
      });
    } else {
      await logError("Failed to run tests using Allure due to unexpected error", error as Error);

      allureReport.realtimeDispatcher.sendGlobalError({
        message: (error as Error).message,
        trace: (error as Error).stack,
      });
    }
  }

  const processFailed = Math.abs(globalExitCode.actual ?? globalExitCode.original) !== 0;

  if (!ignoreLogs && testProcessResult?.stdout) {
    const fileName = randomUUID();
    const stdoutResultFile = new BufferResultFile(Buffer.from(testProcessResult.stdout, "utf8"), `${fileName}`);

    stdoutResultFile.contentType = "text/plain";

    allureReport.realtimeDispatcher.sendGlobalAttachment(stdoutResultFile, "stdout.txt");
  }

  if (!ignoreLogs && testProcessResult?.stderr) {
    const fileName = randomUUID();
    const stderrResultFile = new BufferResultFile(Buffer.from(testProcessResult.stderr, "utf8"), fileName);

    stderrResultFile.contentType = "text/plain";

    allureReport.realtimeDispatcher.sendGlobalAttachment(stderrResultFile, "stderr.txt");
  }

  if (processFailed) {
    const processFailureTrace = [testProcessResult?.stderr, testProcessResult?.stdout]
      .filter((output): output is string => !!output)
      .join("\n");

    allureReport.realtimeDispatcher.sendGlobalError({
      message: "Test process has failed",
      ...(processFailureTrace ? { trace: processFailureTrace } : {}),
    });
  }

  allureReport.realtimeDispatcher.sendGlobalExitCode(globalExitCode);

  await allureReport.done();

  return {
    globalExitCode,
    testProcessResult,
  };
};
