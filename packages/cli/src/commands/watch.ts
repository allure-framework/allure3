import * as console from "node:console";
import { realpath } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import process, { exit } from "node:process";

import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
import type { Watcher } from "@allurereport/directory-watcher";
import { allureResultsDirectoriesWatcher, newFilesInDirectoryWatcher } from "@allurereport/directory-watcher";
import Awesome from "@allurereport/plugin-awesome";
import ProgressPlugin from "@allurereport/plugin-progress";
import ServerReloadPlugin from "@allurereport/plugin-server-reload";
import { PathResultFile } from "@allurereport/reader-api";
import { serve } from "@allurereport/static-server";
import { Command, Option } from "clipanion";
import { red } from "yoctocolors";

import { findAllureResultDirectories } from "../utils/fileSystem.js";

export class WatchCommand extends Command {
  static paths = [["watch"]];

  static usage = Command.Usage({
    description: "Watches Allure Results changes in Real-time",
    details: "This command watches for changes in the Allure Results directory and updates the report in real-time.",
    examples: [
      ["watch ./allure-results", "Watch for changes in the ./allure-results directory"],
      [
        "watch ./allure-results --port 8080",
        "Watch for changes in the ./allure-results directory and serve the report on port 8080",
      ],
      ["watch ./packages/*/allure-results", "Watch for changes in all Allure result directories matching the pattern"],
      [
        "watch ./packages/foo/allure-results ./packages/bar/allure-results",
        "Watch for changes in two Allure result directories",
      ],
    ],
  });

  resultsDir = Option.Rest({
    name: "Patterns to match test results directories in the current working directory (default: ./**/allure-results)",
  });

  config = Option.String("--config,-c", {
    description: "The path Allure config file",
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

  newOnly = Option.Boolean("--new-only", {
    description:
      "Skip whatever test results already exist on disk at startup and only react to results written after the watch has started, instead of ingesting the existing backlog first (default: false)",
  });

  async execute() {
    const cwd = await realpath(this.cwd ?? process.cwd());
    // with the default pattern (no explicit directories given), watch for allure-results
    // directories showing up dynamically — a directory that doesn't exist yet (e.g. a package
    // whose tests haven't run for the first time) will still be picked up once it appears,
    // instead of only ever seeing the directories that existed at startup.
    const useDynamicDiscovery = !this.resultsDir?.length;
    let resultDirectories: string[] = [];

    if (!useDynamicDiscovery) {
      const found = await findAllureResultDirectories(cwd, this.resultsDir);

      if (!found.resultDirectories.length) {
        console.error(red(`No test results directories found matching pattern: ${found.patterns}`));
        exit(1);
        return;
      }

      resultDirectories = found.resultDirectories;
    }

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
          plugin: new ProgressPlugin(),
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

    if (useDynamicDiscovery) {
      const perDirectoryWatchers = new Map<string, Watcher>();
      const discoveryWatcher = allureResultsDirectoriesWatcher(cwd, async (newDirectories, deletedDirectories) => {
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
            { ignoreInitial: this.newOnly },
          );

          perDirectoryWatchers.set(newDir, watcher);

          await watcher.initialScan();
        }
      });

      await discoveryWatcher.initialScan();

      abortFunctions.push(discoveryWatcher.abort);
      abortFunctions.push(async (immediately?: boolean) => {
        for (const watcher of perDirectoryWatchers.values()) {
          await watcher.abort(immediately);
        }

        perDirectoryWatchers.clear();
      });
    } else {
      for (const directory of resultDirectories) {
        const { abort } = newFilesInDirectoryWatcher(
          directory,
          async (path) => {
            await allureReport.readResult(new PathResultFile(path));
          },
          { ignoreInitial: this.newOnly },
        );

        abortFunctions.push(abort);
      }
    }

    const pluginIdToOpen = config.plugins?.find((plugin) => !!plugin.options.open)?.id;

    if (pluginIdToOpen) {
      await server.open(join(server.url, pluginIdToOpen));
    }

    console.info("Press Ctrl+C to exit");

    let interruptCount = 0;

    process.on("SIGINT", () => {
      interruptCount += 1;

      // new line for ctrl+C character
      console.log("");

      if (interruptCount > 1) {
        console.log("force exiting...");
        process.exit(130);
      }

      console.log("stopping, please wait (press Ctrl+C again to force exit)...");

      const shutdownTimeout = setTimeout(() => {
        console.log("shutdown is taking too long, force exiting...");
        process.exit(130);
      }, 5_000);

      shutdownTimeout.unref();

      void (async () => {
        // abort(true) interrupts any in-progress directory scan right away, instead of waiting
        // for it to index every remaining file (which can take a while for large result sets).
        for (const abort of abortFunctions) {
          await abort(true);
        }

        await server.stop();
        await allureReport.done();

        process.exit(0);
      })();
    });
  }
}
