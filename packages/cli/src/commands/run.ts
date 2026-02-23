import {
  AllureReport,
  QualityGateState,
  isFileNotFoundError,
  readConfig,
  stringifyQualityGateResults,
} from "@allurereport/core";
import { type KnownTestFailure, createTestPlan } from "@allurereport/core-api";
import type { Watcher } from "@allurereport/directory-watcher";
import {
  allureResultsDirectoriesWatcher,
  delayedFileProcessingWatcher,
  newFilesInDirectoryWatcher,
} from "@allurereport/directory-watcher";
import type { ExitCode, QualityGateValidationResult } from "@allurereport/plugin-api";
import Awesome from "@allurereport/plugin-awesome";
import { BufferResultFile, PathResultFile } from "@allurereport/reader-api";
import { KnownError } from "@allurereport/service";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process, { exit } from "node:process";
import { red } from "yoctocolors";
import { logTests, runProcess, terminationOf } from "../utils/index.js";
import { logError } from "../utils/logs.js";
import { stopProcessTree } from "../utils/process.js";

export type TestProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  qualityGateResults: QualityGateValidationResult[];
};

const runTests = async (params: {
  allureReport: AllureReport;
  knownIssues: KnownTestFailure[];
  cwd: string;
  command: string;
  commandArgs: string[];
  environmentVariables: Record<string, string>;
  environment?: string;
  withQualityGate: boolean;
  silent?: boolean;
  logs?: "pipe" | "inherit" | "ignore";
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

  const code = await terminationOf(testProcess);
  const afterProcess = Date.now();

  if (code !== null) {
    console.log(`process finished with code ${code} (${afterProcess - beforeProcess}ms)`);
  } else {
    console.log(`process terminated (${afterProcess - beforeProcess}ms)`);
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

export class RunCommand extends Command {
  static paths = [["run"]];

  static usage = Command.Usage({
    description: "Run specified command",
    details: "This command runs the specified command and collects Allure results.",
    examples: [
      ["run -- npm run test", "Run npm run test and collect Allure results"],
      ["run --rerun 3 -- npm run test", "Run npm run test and rerun failed tests up to 3 times"],
      [
        "run --dump=my-dump -- npm run test",
        "Run npm run test and pack inner report state into my-dump.zip archive to restore the state in the next run",
      ],
    ],
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  output = Option.String("--output,-o", {
    description: "The output file name, allure.csv by default. Accepts absolute paths (default: ./allure-report)",
  });

  open = Option.Boolean("--open", {
    description: "Open the report in the default browser after generation (default: false)",
  });

  port = Option.String("--port", {
    description: "The port to serve the reports on. If not set, the server starts on a random port",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name (default: Allure Report)",
  });

  rerun = Option.String("--rerun", {
    description: "The number of reruns for failed tests (default: 0)",
  });

  silent = Option.Boolean("--silent", {
    description: "Don't pipe the process output logs to console (default: 0)",
  });

  ignoreLogs = Option.Boolean("--ignore-logs", {
    description: "Prevent logs attaching to the report (default: false)",
  });

  dump = Option.String("--dump", {
    description:
      "Runs tests in dump mode to collect results to a dump archive with the provided name (default: empty string)",
  });

  environment = Option.String("--environment,--env", {
    description:
      "Force specific environment to all tests in the run. Given environment has higher priority than the one defined in the config file (default: empty string)",
  });

  historyLimit = Option.String("--history-limit", {
    description: "Limits the number of history entries to keep (default: unlimited)",
  });

  commandToRun = Option.Rest();

  get logs() {
    if (this.silent) {
      return this.ignoreLogs ? "ignore" : "pipe";
    }

    return this.ignoreLogs ? "inherit" : "pipe";
  }

  async execute() {
    const args = this.commandToRun.filter((arg) => arg !== "--") as string[] | undefined;

    if (!args || !args.length) {
      throw new Error("expecting command to be specified after --, e.g. allure run -- npm run test");
    }

    const before = new Date().getTime();

    process.on("exit", (exitCode) => {
      const after = new Date().getTime();

      console.log(`exit code ${exitCode} (${after - before}ms)`);
    });

    const command = args[0];
    const commandArgs = args.slice(1);
    const cwd = await realpath(this.cwd ?? process.cwd());

    console.log(`${command} ${commandArgs.join(" ")}`);

    const maxRerun = this.rerun ? parseInt(this.rerun, 10) : 0;
    const config = await readConfig(cwd, this.config, {
      output: this.output,
      name: this.reportName,
      open: this.open,
      port: this.port,
      historyLimit: this.historyLimit ? parseInt(this.historyLimit, 10) : undefined,
    });
    const withQualityGate = !!config.qualityGate;
    const withRerun = !!this.rerun;

    if (withQualityGate && withRerun) {
      console.error(red("At this moment, quality gate and rerun can't be used at the same time!"));
      console.error(red("Consider using --rerun=0 or disable quality gate in the config to run tests"));
      exit(-1);
    }

    try {
      await rm(config.output, { recursive: true });
    } catch (e) {
      if (!isFileNotFoundError(e)) {
        console.error("could not clean output directory", e);
      }
    }
    const allureReport = new AllureReport({
      ...config,
      environment: this.environment,
      dump: this.dump,
      realTime: false,
      plugins: [
        ...(config.plugins?.length
          ? config.plugins
          : [
              {
                id: "awesome",
                enabled: true,
                options: {},
                plugin: new Awesome({
                  reportName: config.name,
                }),
              },
            ]),
      ],
    });
    const knownIssues = await allureReport.store.allKnownIssues();

    await allureReport.start();

    const globalExitCode: ExitCode = {
      original: 0,
      actual: undefined,
    };
    let qualityGateResults: QualityGateValidationResult[];
    let testProcessResult: TestProcessResult | null = null;

    try {
      testProcessResult = await runTests({
        logs: this.logs,
        silent: this.silent,
        allureReport,
        knownIssues,
        cwd,
        command,
        commandArgs,
        environment: this.environment,
        environmentVariables: {},
        withQualityGate,
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
          silent: this.silent,
          logs: this.logs,
          allureReport,
          knownIssues,
          cwd,
          command,
          commandArgs,
          environment: this.environment,
          environmentVariables: {
            ALLURE_TESTPLAN_PATH: testPlanPath,
            ALLURE_RERUN: `${rerun}`,
          },
          withQualityGate,
        });

        await rm(tmpDir, { recursive: true });

        logTests(await allureReport.store.allTestResults());
      }

      const trs = await allureReport.store.allTestResults({ includeHidden: false });
      qualityGateResults = testProcessResult?.qualityGateResults ?? [];

      if (withQualityGate && !qualityGateResults?.length) {
        const { results } = await allureReport.validate({
          trs,
          knownIssues,
          environment: this.environment,
        });

        qualityGateResults = results;
      }

      if (qualityGateResults?.length) {
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

    if (!this.ignoreLogs && testProcessResult?.stdout) {
      const fileName = randomUUID();
      const stdoutResultFile = new BufferResultFile(Buffer.from(testProcessResult.stdout, "utf8"), `${fileName}`);

      stdoutResultFile.contentType = "text/plain";

      allureReport.realtimeDispatcher.sendGlobalAttachment(stdoutResultFile, "stdout.txt");
    }

    if (!this.ignoreLogs && testProcessResult?.stderr) {
      const fileName = randomUUID();
      const stderrResultFile = new BufferResultFile(Buffer.from(testProcessResult.stderr, "utf8"), fileName);

      stderrResultFile.contentType = "text/plain";

      allureReport.realtimeDispatcher.sendGlobalAttachment(stderrResultFile, "stderr.txt");

      if (processFailed) {
        allureReport.realtimeDispatcher.sendGlobalError({
          message: "Test process has failed",
          trace: testProcessResult.stderr,
        });
      }
    }

    allureReport.realtimeDispatcher.sendGlobalExitCode(globalExitCode);

    await allureReport.done();

    if (config.open) {
      await serve({
        port: config.port ? parseInt(config.port, 10) : undefined,
        servePath: config.output,
        open: true,
      });
    } else {
      exit(globalExitCode.actual ?? globalExitCode.original);
    }
  }
}
