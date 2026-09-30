import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { Logger } from "@allurereport/cli-commons";
import {
  AllureReport,
  QualityGateState,
  filterFailedQualityGateResults,
  stringifyQualityGateResults,
} from "@allurereport/core";
import { createTestPlan, formatDuration, type TestResult } from "@allurereport/core-api";
import type { Watcher } from "@allurereport/directory-watcher";
import {
  allureResultsDirectoriesWatcher,
  delayedFileProcessingWatcher,
  newFilesInDirectoryWatcher,
} from "@allurereport/directory-watcher";
import { formatProcessLogAttachmentName } from "@allurereport/plugin-agent";
import type { ExitCode, QualityGateValidationResult } from "@allurereport/plugin-api";
import { BufferResultFile, PathResultFile } from "@allurereport/reader-api";
import { KnownError } from "@allurereport/service";

import { runProcess, terminationOf } from "../../utils/index.js";
import { logError } from "../../utils/logs.js";
import { PosixProcessSupervisor } from "../../utils/supervisor/index.js";
import { allureResultsDirectoriesGlobWatcher } from "./resultsDiscovery.js";

export type TestProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  qualityGateResults: QualityGateValidationResult[];
  fastFailed: boolean;
};

export type RunLogsMode = "pipe" | "inherit" | "ignore";

type RunAttempt = {
  current: number;
  total: number;
};

const runLogger = new Logger("AllureRun");
const qualityGateLogger = new Logger("QualityGate");
const rerunLogger = new Logger("AllureRerun");

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

  return await terminationOf(nestedProcess);
};

const attachResultsDirectoryWatchers = (params: {
  cwd: string;
  resultsPatterns: readonly string[];
  onUpdate: (newDirs: Set<string>, deletedDirs: Set<string>) => Promise<void>;
}): Watcher => {
  if (params.resultsPatterns.length > 0) {
    return allureResultsDirectoriesGlobWatcher(params.cwd, params.resultsPatterns, params.onUpdate, {
      indexDelay: 600,
    });
  }

  return allureResultsDirectoriesWatcher(params.cwd, params.onUpdate, { indexDelay: 600 });
};

export const runTests = async (params: {
  allureReport: AllureReport;
  cwd: string;
  command: string;
  commandArgs: string[];
  environmentVariables: Record<string, string>;
  environment?: string;
  withQualityGate: boolean;
  silent?: boolean;
  logs?: RunLogsMode;
  logProcessExit?: boolean;
  attempt?: RunAttempt;
  resultsPatterns?: readonly string[];
}): Promise<TestProcessResult | null> => {
  if (process.platform === "win32") {
    throw new KnownError("Windows is not currently supported by allure run.");
  }

  const {
    allureReport,
    cwd,
    command,
    commandArgs,
    logs,
    environmentVariables,
    environment,
    withQualityGate,
    silent,
    logProcessExit = true,
    attempt = { current: 1, total: 1 },
    resultsPatterns = [],
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
  const allureResultsWatch = attachResultsDirectoryWatchers({
    cwd,
    resultsPatterns,
    onUpdate: async (newAllureResults, deletedAllureResults) => {
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
  });

  await allureResultsWatch.initialScan();

  const supervisor = new PosixProcessSupervisor(command, {
    arguments: commandArgs,
    workingDirectory: cwd,
    environmentVariables,
    stdio: logs,
    silent,
    outputEncoding: "utf-8",
    stopTimeout: 30_000,
  });

  testProcessStarted = true;

  const beforeProcess = Date.now();
  const commandLine = [command, ...commandArgs].join(" ");
  const rerunsEnabled = attempt.total > 1;

  if (logProcessExit) {
    if (rerunsEnabled) {
      runLogger.info(`Attempt ${attempt.current}/${attempt.total} started: ${commandLine}`);
    } else {
      runLogger.info(`Running: ${commandLine}`);
    }
  }

  supervisor.start();

  const qualityGateState = new QualityGateState();
  let qualityGateUnsub: ReturnType<typeof allureReport.realtimeSubscriber.onTestResults> | undefined;
  let qualityGateResults: QualityGateValidationResult[] = [];
  let fastFailTriggered = false;

  if (withQualityGate) {
    qualityGateUnsub = allureReport.realtimeSubscriber.onTestResults(async (testResults) => {
      if (fastFailTriggered) {
        return;
      }

      const trs = await Promise.all(testResults.map((tr) => allureReport.store.testResultById(tr)));
      const filteredTrs = trs.filter((tr) => tr !== undefined);

      if (!filteredTrs.length) {
        return;
      }

      const { results, fastFailed } = await allureReport.validate({
        trs: filteredTrs,
        state: qualityGateState,
        environment,
      });

      // process only fast-failed checks here
      if (!fastFailed) {
        return;
      }

      qualityGateUnsub?.();

      fastFailTriggered = true;
      qualityGateResults = results;
      qualityGateUnsub = undefined;

      const failedRules = filterFailedQualityGateResults(results).map(({ rule }) => rule);
      const failedRulesMessage = failedRules.length > 0 ? `: ${failedRules.join(", ")}` : "";
      const stopTarget = rerunsEnabled ? `attempt ${attempt.current}/${attempt.total}` : "test process";

      qualityGateLogger.info(`Fast-fail triggered${failedRulesMessage}; stopping ${stopTarget}`);

      await supervisor.stop();
    });
  }

  const code = await supervisor.exitCode;
  const afterProcess = Date.now();

  if (logProcessExit && rerunsEnabled) {
    const duration = formatDuration(afterProcess - beforeProcess);

    if (fastFailTriggered) {
      runLogger.info(`Attempt ${attempt.current}/${attempt.total} stopped by Quality Gate after ${duration}`);
    } else if (code !== null) {
      runLogger.info(`Attempt ${attempt.current}/${attempt.total} finished with code ${code} after ${duration}`);
    } else {
      runLogger.warn(`Attempt ${attempt.current}/${attempt.total} terminated after ${duration}`);
    }
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
    stdout: await supervisor.stdout,
    stderr: await supervisor.stderr,
    qualityGateResults,
    fastFailed: fastFailTriggered,
  };
};

const relatedQualityGateTestResults = async (
  allureReport: AllureReport,
  qualityGateResults: QualityGateValidationResult[],
): Promise<TestResult[]> => {
  const testResultIds = new Set(
    filterFailedQualityGateResults(qualityGateResults).flatMap(({ testResults }) => testResults),
  );
  const testResults = await Promise.all([...testResultIds].map((id) => allureReport.store.testResultById(id)));

  return testResults.filter((testResult): testResult is TestResult => testResult !== undefined);
};

const publishProcessGlobals = (params: {
  allureReport: AllureReport;
  command: string;
  commandArgs: string[];
  ignoreLogs?: boolean;
  processFailed: boolean;
  testProcessResult: TestProcessResult | null;
}) => {
  const { allureReport, command, commandArgs, ignoreLogs, processFailed, testProcessResult } = params;

  if (!ignoreLogs && testProcessResult?.stdout) {
    const fileName = randomUUID();
    const stdoutResultFile = new BufferResultFile(Buffer.from(testProcessResult.stdout, "utf8"), `${fileName}`);

    stdoutResultFile.contentType = "text/plain";

    allureReport.realtimeDispatcher.sendProcessGlobalAttachment(
      stdoutResultFile,
      formatProcessLogAttachmentName([command, ...commandArgs].join(" "), "stdout"),
    );
  }

  if (!ignoreLogs && testProcessResult?.stderr) {
    const fileName = randomUUID();
    const stderrResultFile = new BufferResultFile(Buffer.from(testProcessResult.stderr, "utf8"), fileName);

    stderrResultFile.contentType = "text/plain";

    allureReport.realtimeDispatcher.sendProcessGlobalAttachment(
      stderrResultFile,
      formatProcessLogAttachmentName([command, ...commandArgs].join(" "), "stderr"),
    );

    if (processFailed) {
      allureReport.realtimeDispatcher.sendProcessGlobalError({
        message: "Test process has failed",
        trace: testProcessResult.stderr,
      });
    }
  }
};

export const executeAllureRun = async (params: {
  allureReport: AllureReport;
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
  resultsPatterns?: readonly string[];
}): Promise<{
  globalExitCode: ExitCode;
  testProcessResult: TestProcessResult | null;
}> => {
  const {
    allureReport,
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
    resultsPatterns = [],
  } = params;
  const totalAttempts = maxRerun + 1;

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
      cwd,
      command,
      commandArgs,
      environment,
      environmentVariables,
      withQualityGate,
      logProcessExit,
      attempt: {
        current: 1,
        total: totalAttempts,
      },
      resultsPatterns,
    });

    const allFailuresAfterInitialRun = await allureReport.store.failedTestResults();
    const blockingFailuresAfterInitialRun = await allureReport.store.blockingFailedTestResults();

    if (allFailuresAfterInitialRun.length > 0 && blockingFailuresAfterInitialRun.length === 0 && testProcessResult) {
      globalExitCode.actual = 0;
    }

    if (maxRerun > 0) {
      publishProcessGlobals({
        allureReport,
        command,
        commandArgs,
        ignoreLogs,
        processFailed: Math.abs(globalExitCode.actual ?? testProcessResult?.code ?? -1) !== 0,
        testProcessResult,
      });
    }

    for (let rerun = 0; rerun < maxRerun && testProcessResult; rerun++) {
      const nextAttempt: RunAttempt = {
        current: rerun + 2,
        total: totalAttempts,
      };
      const fullRerun = testProcessResult.fastFailed;
      let testResultsToRerun: TestResult[] = [];

      if (!fullRerun) {
        const blockingFailures = await allureReport.store.blockingFailedTestResults();
        let relatedTestResults: TestResult[] = [];

        if (withQualityGate) {
          const currentTestResults = await allureReport.store.allTestResults({ includeRetries: false });
          const { results } = await allureReport.validate({
            trs: currentTestResults,
            environment,
          });

          relatedTestResults = await relatedQualityGateTestResults(allureReport, results);
        }

        testResultsToRerun = [
          ...new Map(
            [...blockingFailures, ...relatedTestResults].map((testResult) => [testResult.id, testResult]),
          ).values(),
        ];

        if (testResultsToRerun.length === 0) {
          rerunLogger.info(
            "No blocking failures or failed Quality Gate-related tests remain; no further reruns are needed",
          );
          break;
        }
      }

      const testPlan = createTestPlan(testResultsToRerun);

      if (fullRerun) {
        rerunLogger.warn(
          `Attempt ${nextAttempt.current}/${nextAttempt.total}: Quality Gate fast-fail interrupted the previous attempt; restarting full test process`,
        );
      } else {
        const testWord = testPlan.tests.length === 1 ? "test" : "tests";

        rerunLogger.info(
          `Attempt ${nextAttempt.current}/${nextAttempt.total}: rerunning ${testPlan.tests.length} failed, broken, or Quality Gate-related ${testWord}`,
        );

        testResultsToRerun.forEach(({ fullName, status }) => {
          rerunLogger.debug(`${fullName} (${status})`);
        });
      }

      const tmpDir = fullRerun ? undefined : await mkdtemp(join(tmpdir(), "allure-run-"));
      const testPlanPath = tmpDir ? resolve(tmpDir, `${rerun}-testplan.json`) : undefined;

      try {
        if (testPlanPath) {
          await writeFile(testPlanPath, JSON.stringify(testPlan));
          rerunLogger.debug(`Test plan: ${testPlanPath}`);
        }

        allureReport.realtimeDispatcher.sendProcessGlobalsReset();

        testProcessResult = await runTests({
          silent,
          logs,
          allureReport,
          cwd,
          command,
          commandArgs,
          environment,
          environmentVariables: {
            ...environmentVariables,
            ...(testPlanPath ? { ALLURE_TESTPLAN_PATH: testPlanPath } : {}),
            ALLURE_RERUN: `${rerun}`,
          },
          withQualityGate,
          logProcessExit,
          attempt: nextAttempt,
          resultsPatterns,
        });
      } finally {
        if (tmpDir) {
          await rm(tmpDir, { recursive: true, force: true });
        }
      }

      const allFailuresAfterRerun = await allureReport.store.failedTestResults();
      const blockingFailuresAfterRerun = await allureReport.store.blockingFailedTestResults();

      publishProcessGlobals({
        allureReport,
        command,
        commandArgs,
        ignoreLogs,
        processFailed:
          Math.abs(
            allFailuresAfterRerun.length > 0 && blockingFailuresAfterRerun.length === 0
              ? 0
              : (testProcessResult?.code ?? -1),
          ) !== 0,
        testProcessResult,
      });
    }

    const allFailuresAfterReruns = await allureReport.store.failedTestResults();
    const blockingFailuresAfterReruns = await allureReport.store.blockingFailedTestResults();

    if (allFailuresAfterReruns.length > 0 && blockingFailuresAfterReruns.length === 0 && testProcessResult) {
      globalExitCode.actual = 0;
    }

    const trs = await allureReport.store.allTestResults({ includeRetries: false });
    qualityGateResults = testProcessResult?.qualityGateResults ?? [];

    if (withQualityGate && !qualityGateResults.length) {
      const { results } = await allureReport.validate({
        trs,
        environment,
      });

      qualityGateResults = results;
    }

    if (qualityGateResults.length) {
      const qualityGateMessage = stringifyQualityGateResults(qualityGateResults);

      // passed rules are only reported through the report, the terminal keeps showing failures
      if (qualityGateMessage) {
        qualityGateLogger.error(qualityGateMessage);
      }

      allureReport.realtimeDispatcher.sendQualityGateResults(qualityGateResults);
    }

    globalExitCode.original = testProcessResult?.code ?? -1;

    if (withQualityGate) {
      globalExitCode.actual = filterFailedQualityGateResults(qualityGateResults).length > 0 ? 1 : 0;
    }
  } catch (error) {
    globalExitCode.actual = 1;

    if (error instanceof KnownError) {
      runLogger.error(error.message);

      allureReport.realtimeDispatcher.sendGlobalError({
        message: error.message,
      });
    } else {
      await logError("Failed to run tests using Allure due to unexpected error", error as Error, (message) =>
        runLogger.error(message),
      );

      allureReport.realtimeDispatcher.sendGlobalError({
        message: (error as Error).message,
        trace: (error as Error).stack,
      });
    }
  }

  const processFailed = Math.abs(globalExitCode.actual ?? globalExitCode.original) !== 0;

  if (maxRerun === 0) {
    publishProcessGlobals({
      allureReport,
      command,
      commandArgs,
      ignoreLogs,
      processFailed,
      testProcessResult,
    });
  }

  allureReport.realtimeDispatcher.sendGlobalExitCode(globalExitCode);

  await allureReport.done();

  return {
    globalExitCode,
    testProcessResult,
  };
};
