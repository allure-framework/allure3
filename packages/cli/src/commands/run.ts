import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
import { createTestPlan } from "@allurereport/core-api";
import type { Watcher } from "@allurereport/directory-watcher";
import {
  allureResultsDirectoriesWatcher,
  delayedFileProcessingWatcher,
  newFilesInDirectoryWatcher,
} from "@allurereport/directory-watcher";
import AllureAwesome from "@allurereport/plugin-awesome";
import { PathResultFile } from "@allurereport/reader-api";
import * as console from "node:console";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { createCommand } from "../utils/commands.js";
import { logTests, runProcess, terminationOf } from "../utils/index.js";

export type RunCommandOptions = {
  config?: string;
  cwd?: string;
  output?: string;
  reportName?: string;
  rerun?: number;
  silent?: boolean;
} & Record<"--", string[]>;

const runTests = async (
  allureReport: AllureReport,
  cwd: string,
  command: string,
  commandArgs: string[],
  environment: Record<string, string>,
  silent: boolean,
) => {
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
  const testProcess = runProcess(command, commandArgs, cwd, environment, silent);
  const code = await terminationOf(testProcess);
  const afterProcess = Date.now();

  console.log(`process finished with code ${code ?? 0} (${afterProcess - beforeProcess})ms`);

  await allureResultsWatch.abort();

  for (const [ar, watcher] of allureResultsWatchers) {
    await watcher.abort();
    allureResultsWatchers.delete(ar);
  }

  await processWatcher.abort();
  return code;
};

export const RunCommandAction = async (options: RunCommandOptions) => {
  const args = options["--"];

  if (!args || !args.length) {
    throw new Error("expecting command to be specified after --, e.g. allure run -- npm run test");
  }

  const before = new Date().getTime();
  process.on("exit", (code) => {
    const after = new Date().getTime();

    console.log(`exit code ${code} (${after - before}ms)`);
  });

  const command = args[0];
  const commandArgs = args.slice(1);

  const cwd = await realpath(options.cwd ?? process.cwd());

  console.log(`${command} ${commandArgs.join(" ")}`);

  const { config: configPath, output, reportName, rerun: maxRerun = 0, silent = false } = options;
  const config = await readConfig(cwd, configPath, { output, name: reportName });

  try {
    await rm(config.output, { recursive: true });
  } catch (e) {
    if (!isFileNotFoundError(e)) {
      console.error("could not clean output directory", e);
    }
  }

  const allureReport = new AllureReport({
    ...config,
    realTime: false,
    plugins: [
      ...(config.plugins?.length
        ? config.plugins
        : [
            {
              id: "awesome",
              enabled: true,
              options: {},
              plugin: new AllureAwesome({
                reportName: config.name,
              }),
            },
          ]),
    ],
  });

  await allureReport.start();

  let code = await runTests(allureReport, cwd, command, commandArgs, {}, silent);

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

    code = await runTests(
      allureReport,
      cwd,
      command,
      commandArgs,
      {
        ALLURE_TESTPLAN_PATH: testPlanPath,
        ALLURE_RERUN: `${rerun}`,
      },
      silent,
    );

    await rm(tmpDir, { recursive: true });
    logTests(await allureReport.store.allTestResults());
  }

  await allureReport.done();
  await allureReport.validate();

  process.exit(code ?? allureReport.exitCode);
};

export const RunCommand = createCommand({
  name: "run",
  description: "Run specified command",
  options: [
    [
      "--config, -c <file>",
      {
        description: "The path Allure config file",
      },
    ],
    [
      "--cwd <cwd>",
      {
        description: "The working directory for the command to run (Default: current working directory)",
      },
    ],
    [
      "--output, -o <file>",
      {
        description: "The output file name, allure.csv by default. Accepts absolute paths (Default: ./allure-report)",
      },
    ],
    [
      "--report-name, --name <string>",
      {
        description: "The report name (Default: Allure Report)",
      },
    ],
    [
      "--rerun <number>",
      {
        description: "The number of reruns for failed tests (Default: 0)",
      },
    ],
    [
      "--silent",
      {
        description: "Don't pipe the process output logs to console (Default: 0)",
      },
    ],
  ],
  action: RunCommandAction,
});
