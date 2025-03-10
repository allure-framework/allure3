import { AllureReport, isFileNotFoundError, readConfig } from "@allurereport/core";
import { newFilesInDirectoryWatcher } from "@allurereport/directory-watcher";
import Awesome from "@allurereport/plugin-awesome";
import ProgressPlugin from "@allurereport/plugin-progress";
import ServerReloadPlugin from "@allurereport/plugin-server-reload";
import { PathResultFile } from "@allurereport/reader-api";
import { serve } from "@allurereport/static-server";
import * as console from "node:console";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import { createCommand } from "../utils/commands.js";

type WatchCommandOptions = {
  config?: string;
  output?: string;
  cwd?: string;
  reportName?: string;
  port?: string;
};

export const WatchCommandAction = async (resultsDir: string, options: WatchCommandOptions) => {
  const before = new Date().getTime();

  process.on("exit", (code) => {
    const after = new Date().getTime();

    console.log(`exit code ${code} (${after - before}ms)`);
  });

  const { config: configPath, output, cwd, reportName } = options;
  const config = await readConfig(cwd, configPath, { output, name: reportName });

  try {
    await rm(config.output, { recursive: true });
  } catch (e) {
    if (!isFileNotFoundError(e)) {
      console.error("could not clean output directory", e);
    }
  }

  const server = await serve({
    servePath: config.output,
    port: options.port ? parseInt(options.port, 10) : undefined,
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
              options: {},
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

  const input = resolve(resultsDir);
  const { abort } = newFilesInDirectoryWatcher(input, async (path) => {
    await allureReport.readResult(new PathResultFile(path));
  });

  const pluginIdToOpen = config.plugins?.find((plugin) => !!plugin.options.open)?.id;
  if (pluginIdToOpen) {
    await server.open(join(server.url, pluginIdToOpen));
  } else {
    await server.open(server.url);
  }

  console.info("Press Ctrl+C to exit");

  process.on("SIGINT", async () => {
    // new line for ctrl+C character
    console.log("");
    await abort();
    await server.stop();
    await allureReport.done();
    process.exit(0);
  });
};

export const WatchCommand = createCommand({
  name: "watch <resultsDir>",
  description: "Watches Allure Results changes in Real-time",
  options: [
    [
      "--cwd <cwd>",
      {
        description: "The working directory for the command to run (default: current working directory)",
      },
    ],
    [
      "--output, -o <file>",
      {
        description: "The output file name, allure.csv by default. Accepts absolute paths (default: ./allure-report)",
      },
    ],
    [
      "--report-name, --name <string>",
      {
        description: "The report name (default: Allure Report)",
      },
    ],
    [
      "--port <port>",
      {
        description: "The port to serve the reports on (default: random port)",
      },
    ],
  ],
  action: WatchCommandAction,
});
