import type { ChildProcess } from "node:child_process";
import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { AllureReport, QualityGateState, stringifyQualityGateResults } from "@allurereport/core";
import { type KnownTestFailure, createTestPlan } from "@allurereport/core-api";
import type { Watcher } from "@allurereport/directory-watcher";
import {
  allureResultsDirectoriesWatcher,
  delayedFileProcessingWatcher,
  newFilesInDirectoryWatcher,
} from "@allurereport/directory-watcher";
import watchDirectory from "@allurereport/directory-watcher";
import { formatProcessLogAttachmentName } from "@allurereport/plugin-agent";
import type { ExitCode, QualityGateValidationResult } from "@allurereport/plugin-api";
import { BufferResultFile, PathResultFile } from "@allurereport/reader-api";
import { KnownError } from "@allurereport/service";
import { cyan, dim, green, red } from "yoctocolors";

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

  return await terminationOf(nestedProcess);
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
  onProcessStarted?: (testProcess: ChildProcess) => void;
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
    onProcessStarted,
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

  onProcessStarted?.(testProcess);

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

  const code = await terminationOf(testProcess);
  const afterProcess = Date.now();

  if (logProcessExit) {
    if (code !== null) {
      console.log(`process finished with code ${code} (${afterProcess - beforeProcess}ms)`);
    } else {
      console.log(`process terminated (${afterProcess - beforeProcess}ms)`);
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
    stdout: testProcessStdout,
    stderr: testProcessStderr,
    qualityGateResults,
  };
};

const DEFAULT_SPEC_TEST_MATCH = /\.(spec|test)\.[cm]?[jt]sx?$/;
const SPEC_CHANGE_DEBOUNCE_MS = 300;
const GRACEFUL_KILL_TIMEOUT_MS = 5_000;

/**
 * Fast-path watch mode: watches source files under `cwd` and, when a changed file looks like a
 * spec file (matches `testMatch`), reruns the test command scoped to just that file (passed as
 * a trailing positional arg), instead of rerunning the whole suite.
 *
 * This intentionally does not try to map non-spec source file changes to related specs — that's
 * a separate, heavier problem (dependency graph). Non-spec changes are ignored.
 */
export const executeAllureWatchRun = async (params: {
  allureReport: AllureReport;
  knownIssues: KnownTestFailure[];
  cwd: string;
  command: string;
  commandArgs: string[];
  outputDir: string;
  environmentVariables?: Record<string, string>;
  environment?: string;
  silent?: boolean;
  logs?: RunLogsMode;
  testMatch?: RegExp;
}): Promise<void> => {
  const {
    allureReport,
    knownIssues,
    cwd,
    command,
    commandArgs,
    outputDir,
    environmentVariables = {},
    environment,
    silent,
    logs,
    testMatch = DEFAULT_SPEC_TEST_MATCH,
  } = params;

  await allureReport.start();

  const ignoredSegments = ["node_modules", ".git", "allure-results", relative(cwd, outputDir)].filter(Boolean);
  const isIgnoredPath = (path: string) =>
    ignoredSegments.some((segment) => relative(cwd, path).split(sep).includes(segment));
  let running = false;
  let stopping = false;
  let currentTestProcess: ChildProcess | undefined;
  const pendingSpecs = new Set<string>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const processQueue = async (): Promise<void> => {
    if (running || stopping) {
      return;
    }

    const next = pendingSpecs.values().next();

    if (next.done) {
      return;
    }

    const specPath = next.value;
    const relativeSpec = relative(cwd, specPath);

    pendingSpecs.delete(specPath);
    running = true;

    try {
      console.log(cyan(`\n● spec changed: ${relativeSpec} — rerunning just this file`));

      const result = await runTests({
        allureReport,
        knownIssues,
        cwd,
        command,
        commandArgs: [...commandArgs, relativeSpec],
        environmentVariables,
        environment,
        withQualityGate: false,
        silent,
        logs,
        logProcessExit: false,
        onProcessStarted: (testProcess) => {
          currentTestProcess = testProcess;
        },
      });

      if (result?.code === 0) {
        console.log(green(`✓ ${relativeSpec} passed`));
      } else {
        console.log(red(`✗ ${relativeSpec} failed (exit code ${result?.code ?? "unknown"})`));
      }
    } catch (error) {
      // one bad run (a spawn failure, a plugin error, …) must not take down the whole watch
      // session — log it and keep watching for the next change instead of letting the exception
      // become an unhandled rejection (processQueue is always invoked fire-and-forget).
      console.log(red(`✗ ${relativeSpec} crashed while running: ${(error as Error)?.message ?? error}`));
    } finally {
      currentTestProcess = undefined;
      running = false;

      if (!stopping) {
        void processQueue();
      }
    }
  };

  const scheduleSpec = (specPath: string) => {
    const existingTimer = debounceTimers.get(specPath);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    debounceTimers.set(
      specPath,
      setTimeout(() => {
        debounceTimers.delete(specPath);
        pendingSpecs.add(specPath);
        void processQueue();
      }, SPEC_CHANGE_DEBOUNCE_MS),
    );
  };

  const stopWatching = watchDirectory(
    cwd,
    (eventName, path) => {
      if (eventName !== "add" && eventName !== "change") {
        return;
      }

      if (isIgnoredPath(path)) {
        return;
      }

      if (!testMatch.test(path)) {
        return;
      }

      scheduleSpec(path);
    },
    { ignoreInitial: true, ignored: isIgnoredPath },
  );

  console.log(dim("watching for changed spec files, press Ctrl+C to exit"));

  await new Promise<void>((resolvePromise) => {
    let interruptCount = 0;

    process.on("SIGINT", () => {
      interruptCount += 1;

      console.log("");

      if (interruptCount > 1) {
        // the user is insisting: stop being graceful and force-kill immediately.
        console.log("force exiting...");

        if (currentTestProcess?.pid) {
          void stopProcessTree(currentTestProcess.pid, { signal: "SIGKILL" });
        }

        process.exit(130);
      }

      stopping = true;

      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }

      debounceTimers.clear();
      pendingSpecs.clear();

      void (async () => {
        await stopWatching();

        const processToKill = currentTestProcess;

        if (processToKill?.pid) {
          console.log("stopping the running test process...");

          try {
            await stopProcessTree(processToKill.pid, { signal: "SIGTERM" });

            // don't trust the process to actually honor SIGTERM: some tools (dev servers,
            // browsers launched by e2e runners) ignore or delay it. Escalate on our own instead
            // of leaving the user to mash Ctrl+C.
            const exited = await Promise.race([
              terminationOf(processToKill).then(() => true),
              delay(GRACEFUL_KILL_TIMEOUT_MS).then(() => false),
            ]);

            if (!exited) {
              console.log("test process did not exit in time, force killing...");
              await stopProcessTree(processToKill.pid, { signal: "SIGKILL" });
            }
          } catch {
            // the process may have already exited on its own.
          }
        }

        await allureReport.done();
        resolvePromise();
      })();
    });
  });
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

    const trs = await allureReport.store.allTestResults({ includeRetries: false });
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

    allureReport.realtimeDispatcher.sendGlobalAttachment(
      stdoutResultFile,
      formatProcessLogAttachmentName([command, ...commandArgs].join(" "), "stdout"),
    );
  }

  if (!ignoreLogs && testProcessResult?.stderr) {
    const fileName = randomUUID();
    const stderrResultFile = new BufferResultFile(Buffer.from(testProcessResult.stderr, "utf8"), fileName);

    stderrResultFile.contentType = "text/plain";

    allureReport.realtimeDispatcher.sendGlobalAttachment(
      stderrResultFile,
      formatProcessLogAttachmentName([command, ...commandArgs].join(" "), "stderr"),
    );

    if (processFailed) {
      allureReport.realtimeDispatcher.sendGlobalError({
        message: "Test process has failed",
        trace: testProcessResult.stderr,
      });
    }
  }

  allureReport.realtimeDispatcher.sendGlobalExitCode(globalExitCode);

  await allureReport.done();

  return {
    globalExitCode,
    testProcessResult,
  };
};
