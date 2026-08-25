import * as console from "node:console";
import { realpath } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
import type { Watcher } from "@allurereport/directory-watcher";
import { allureResultsDirectoriesWatcher, newFilesInDirectoryWatcher } from "@allurereport/directory-watcher";
import Awesome from "@allurereport/plugin-awesome";
import ProgressPlugin from "@allurereport/plugin-progress";
import ServerReloadPlugin from "@allurereport/plugin-server-reload";
import { PathResultFile } from "@allurereport/reader-api";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";

import { resolveResultsPatterns } from "../utils/resultsPatterns.js";
import { boundedTerminationSignal, notifySignals, waitForAbort } from "../utils/signals.js";
import { allureResultsDirectoriesGlobWatcher } from "./commons/resultsDiscovery.js";

export class WatchCommand extends Command {
  static paths = [["watch"]];

  static usage = Command.Usage({
    description: "Watches Allure Results changes in Real-time",
    details:
      "This command watches for changes in Allure Results directories and updates the report in real-time. " +
      "CLI patterns and config.resultsDir use live re-glob discovery. " +
      "When both are empty, directories named `allure-results` are discovered dynamically (unlike generate, which defaults to `./**/allure-results`). " +
      "Quote globs in the shell so they are not expanded early.",
    examples: [
      ["watch ./allure-results", "Watch for changes in the ./allure-results directory"],
      [
        "watch ./allure-results --port 8080",
        "Watch for changes in the ./allure-results directory and serve the report on port 8080",
      ],
      [
        "watch './packages/*/allure-results'",
        "Watch for changes in all Allure result directories matching the pattern",
      ],
      [
        "watch ./packages/foo/allure-results ./packages/bar/allure-results",
        "Watch for changes in two Allure result directories",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name: "Patterns to match test results directories. Overrides config.resultsDir. Empty patterns use name-based discovery.",
  });

  config = Option.String("--config,-c", {
    description: "The path to Allure config file",
  });

  cwd = Option.String("--cwd", {
    description: "The working directory for the command to run (default: current working directory)",
  });

  output = Option.String("--output,-o", {
    description: "The output directory name. Absolute paths are accepted as well (default: allure-report)",
  });

  reportName = Option.String("--report-name,--name", {
    description: "The report name (default: Allure Report)",
  });

  open = Option.Boolean("--open", {
    description: "Open the report in the default browser after generation (default: false)",
  });

  port = Option.String("--port", {
    description: "The port to serve the reports on (default: random port)",
  });

  preserve = Option.Boolean("--preserve", {
    description: "Don't clear terminal output on the data refresh",
  });

  newOnly = Option.Boolean("--new-only", true, {
    description:
      "Skip whatever test results already exist on disk at startup and only react to results written after the watch has started, instead of ingesting the existing backlog first (default: true). Pass --no-new-only to ingest the existing backlog too",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    const before = new Date().getTime();

    process.on("exit", (code) => {
      const after = new Date().getTime();

      console.log(`exit code ${code} (${after - before}ms)`);
    });

    const config = await readConfig(cwd, this.config, {
      output: this.output,
      name: this.reportName,
      open: this.open,
      port: this.port,
    });
    const resultsPatterns = resolveResultsPatterns(this.resultsDir ?? [], config.resultsDir);
    const useDynamicNameDiscovery = resultsPatterns.length === 0;

    try {
      await rm(config.output, { recursive: true });
    } catch (e) {
      if (!isFileNotFoundError(e)) {
        console.error("could not clean output directory", e);
      }
    }

    // FIXME: do we need to start the server when there's no servable reports in the config?
    const server = await serve({
      servePath: config.output,
      port: this.port ? parseInt(this.port, 10) : undefined,
      live: false,
      open: false,
    });
    const allureReport = new AllureReport({
      ...config,
      realTime: true,
      plugins: [
        ...(config.plugins?.length
          ? config.plugins
          : [
              {
                id: "awesome",
                enabled: true,
                options: {
                  open: config.open,
                },
                plugin: new Awesome({
                  reportName: config.name,
                }),
              },
            ]),
        {
          id: "watch log",
          enabled: true,
          options: {},
          plugin: new ProgressPlugin({ preserve: this.preserve }),
        },
        {
          id: "server reload",
          enabled: true,
          options: {},
          plugin: new ServerReloadPlugin({
            server,
          }),
        },
      ],
    });

    await allureReport.start();

    const abortFunctions: ((immediately?: boolean) => Promise<void>)[] = [];
    const perDirectoryWatchers = new Map<string, Watcher>();
    // only the very first discovery scan reflects pre-existing directories; anything found
    // afterwards is new by definition, so --new-only must not skip its backlog
    let isInitialDiscovery = true;

    const onDiscoveryUpdate = async (newDirectories: Set<string>, deletedDirectories: Set<string>) => {
      for (const deletedDir of deletedDirectories) {
        const watcher = perDirectoryWatchers.get(deletedDir);

        if (watcher) {
          await watcher.abort();
        }

        perDirectoryWatchers.delete(deletedDir);
      }

      for (const newDir of newDirectories) {
        if (perDirectoryWatchers.has(newDir)) {
          continue;
        }

        const watcher = newFilesInDirectoryWatcher(
          newDir,
          async (path) => {
            await allureReport.readResult(new PathResultFile(path));
          },
          { ignoreInitial: this.newOnly && isInitialDiscovery },
        );

        perDirectoryWatchers.set(newDir, watcher);

        await watcher.initialScan();
      }

      isInitialDiscovery = false;
    };

    const discoveryWatcher = useDynamicNameDiscovery
      ? allureResultsDirectoriesWatcher(cwd, onDiscoveryUpdate)
      : allureResultsDirectoriesGlobWatcher(cwd, resultsPatterns, onDiscoveryUpdate, { indexDelay: 600 });

    await discoveryWatcher.initialScan();

    abortFunctions.push(discoveryWatcher.abort);
    abortFunctions.push(async (immediately?: boolean) => {
      for (const watcher of perDirectoryWatchers.values()) {
        await watcher.abort(immediately);
      }

      perDirectoryWatchers.clear();
    });

    const pluginIdToOpen = config.plugins?.find((plugin) => !!plugin.options.open)?.id;

    if (pluginIdToOpen) {
      await server.open(join(server.url, pluginIdToOpen));
    }

    console.info("Press Ctrl+C to exit");

    const notifier = notifySignals(["SIGINT", "SIGTERM"], (signal) => {
      console.log(`\nreceived another ${signal}, force exiting...`);
      process.exit(130);
    });

    await waitForAbort(notifier.signal);

    const signalInfo = notifier.info();

    console.log(`\nreceived ${signalInfo?.signal}, stopping (press again to force exit)...`);

    const terminationSignal = boundedTerminationSignal(signalInfo, 5_000);
    const cleanup = (async () => {
      // abort(true) interrupts an in-progress directory scan instead of finishing it first
      for (const abort of abortFunctions) {
        await abort(true);
      }

      await server.stop();
      await allureReport.done();
    })();

    const timedOut = await Promise.race([cleanup.then(() => false), waitForAbort(terminationSignal).then(() => true)]);

    if (timedOut) {
      console.log("shutdown is taking too long, force exiting...");
      process.exit(130);
    }

    notifier.dispose();
    process.exit(signalInfo?.code ?? 0);
  }
}
