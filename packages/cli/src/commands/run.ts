import {
  AllureReport,
  isFileNotFoundError,
  readConfig,
} from "@allurereport/core";
import { createTestPlan } from "@allurereport/core-api";
import type { Watcher } from "@allurereport/directory-watcher";
import {
  allureResultsDirectoriesWatcher,
  delayedFileProcessingWatcher,
  newFilesInDirectoryWatcher,
} from "@allurereport/directory-watcher";
import Awesome from "@allurereport/plugin-awesome";
import { PathResultFile } from "@allurereport/reader-api";
import { KnownError } from "@allurereport/service";
import { Command, Option } from "clipanion";
import * as console from "node:console";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { red } from "yoctocolors";
import { logTests, runProcess, terminationOf } from "../utils/index.js";
import { logError } from "../utils/logs.js";

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

export class RunCommand extends Command {
  static paths = [["run"]];

  static usage = Command.Usage({
    description: "Run specified command",
    details: "This command runs the specified command and collects Allure results.",
    examples: [
      ["run -- npm run test", "Run npm run test and collect Allure results"],
      ["run --rerun 3 -- npm run test", "Run npm run test and rerun failed tests up to 3 times"],
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

  reportName = Option.String("--report-name,--name", {
    description: "The report name (default: Allure Report)",
  });

  rerun = Option.String("--rerun", {
    description: "The number of reruns for failed tests (default: 0)",
  });

  silent = Option.Boolean("--silent", {
    description: "Don't pipe the process output logs to console (default: 0)",
  });

  commandToRun = Option.Proxy();

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
    const silent = this.silent ?? false;
    const config = await readConfig(cwd, this.config, { output: this.output, name: this.reportName });

    try {
      await rm(config.output, { recursive: true });
    } catch (e) {
      if (!isFileNotFoundError(e)) {
        console.error("could not clean output directory", e);
      }
    }

    try {
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
                  plugin: new Awesome({
                    reportName: config.name,
                  }),
                },
              ]),
        ],
      });

      await allureReport.start();

      allureReport.realtimeSubscriber.onTerminationRequest(async () => {
        // TODO: terminate process here and let the report to process the results
      })

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
    } catch (error) {
      if (error instanceof KnownError) {
        // eslint-disable-next-line no-console
        console.error(red(error.message));
        process.exit(1);
        return;
      }

      await logError("Failed to run tests using Allure due to unexpected error", error as Error);
      process.exit(1);
    }
  }
}
