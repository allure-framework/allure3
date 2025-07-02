import type { AllureHistory } from "@allurereport/core-api";
import type {
  Plugin,
  PluginContext,
  PluginState,
  PluginSummary,
  ReportFiles,
  ResultFile,
} from "@allurereport/plugin-api";
import { allure1, allure2, attachments, cucumberjson, junitXml, readXcResultBundle } from "@allurereport/reader";
import { PathResultFile, type ResultsReader } from "@allurereport/reader-api";
import { AllureRemoteHistory, AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import { generateSummary } from "@allurereport/summary";
import console from "node:console";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { lstat, opendir, readdir, realpath, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { FullConfig, PluginInstance } from "./api.js";
import { AllureLocalHistory, createHistory } from "./history.js";
import { DefaultPluginState, PluginFiles } from "./plugin.js";
import { QualityGate } from "./qualityGate.js";
import { DefaultAllureStore } from "./store/store.js";
import type { AllureStoreEvents } from "./utils/event.js";
import { Events } from "./utils/event.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const initRequired = "report is not initialised. Call the start() method first.";

export class AllureReport {
  readonly #reportUuid: string;
  readonly #reportName: string;
  readonly #store: DefaultAllureStore;
  readonly #readers: readonly ResultsReader[];
  readonly #plugins: readonly PluginInstance[];
  readonly #reportFiles: ReportFiles;
  readonly #eventEmitter: EventEmitter<AllureStoreEvents>;
  readonly #events: Events;
  readonly #qualityGate: QualityGate;
  readonly #realTime: any;
  readonly #output: string;
  readonly #history: AllureHistory | undefined;
  readonly #allureServiceClient: AllureServiceClient | undefined;

  #reportUrl?: string;
  #state?: Record<string, PluginState>;
  #stage: "init" | "running" | "done" = "init";

  constructor(opts: FullConfig) {
    const {
      name,
      readers = [allure1, allure2, cucumberjson, junitXml, attachments],
      plugins = [],
      known,
      reportFiles,
      qualityGate,
      realTime,
      historyPath,
      defaultLabels = {},
      variables = {},
      environments,
      output,
      allureService: allureServiceConfig,
    } = opts;

    this.#allureServiceClient = allureServiceConfig?.url ? new AllureServiceClient(allureServiceConfig) : undefined;
    this.#reportUuid = randomUUID();
    this.#reportName = name;
    this.#eventEmitter = new EventEmitter<AllureStoreEvents>();
    this.#events = new Events(this.#eventEmitter);
    this.#realTime = realTime;

    if (this.#allureServiceClient) {
      this.#history = new AllureRemoteHistory(this.#allureServiceClient);
    } else if (historyPath) {
      this.#history = new AllureLocalHistory(historyPath);
    }

    this.#store = new DefaultAllureStore({
      eventEmitter: this.#eventEmitter,
      reportVariables: variables,
      environmentsConfig: environments,
      history: this.#history,
      known,
      defaultLabels,
    });
    this.#readers = [...readers];
    this.#plugins = [...plugins];
    this.#reportFiles = reportFiles;
    this.#output = output;
    // TODO: where should we execute quality gate?
    this.#qualityGate = new QualityGate(qualityGate);
    this.#history = this.#allureServiceClient
      ? new AllureRemoteHistory(this.#allureServiceClient)
      : new AllureLocalHistory(historyPath);
  }

  // TODO: keep it until we understand how to handle shared test results
  get store(): DefaultAllureStore {
    return this.#store;
  }

  get exitCode() {
    return this.#qualityGate.exitCode;
  }

  get validationResults() {
    return this.#qualityGate.result;
  }

  get #publish() {
    return this.#plugins.some(({ enabled, options }) => enabled && options.publish);
  }

  readDirectory = async (resultsDir: string) => {
    if (this.#stage !== "running") {
      throw new Error(initRequired);
    }

    const resultsDirPath = resolve(resultsDir);

    if (await readXcResultBundle(this.#store, resultsDirPath)) {
      return;
    }

    const dir = await opendir(resultsDirPath);

    try {
      for await (const dirent of dir) {
        if (dirent.isFile()) {
          const path = await realpath(join(dirent.parentPath ?? dirent.path, dirent.name));

          await this.readResult(new PathResultFile(path, dirent.name));
        }
      }
    } catch (e) {
      console.error("can't read directory", e);
    }
  };

  readFile = async (resultsFile: string) => {
    if (this.#stage !== "running") {
      throw new Error(initRequired);
    }
    await this.readResult(new PathResultFile(resultsFile));
  };

  readResult = async (data: ResultFile) => {
    if (this.#stage !== "running") {
      throw new Error(initRequired);
    }

    for (const reader of this.#readers) {
      try {
        const processed = await reader.read(this.#store, data);

        if (processed) {
          return;
        }
      } catch (ignored) {}
    }
  };

  start = async (): Promise<void> => {
    await this.#store.readHistory();

    if (this.#stage === "running") {
      throw new Error("the report is already started");
    }

    if (this.#stage === "done") {
      throw new Error("the report is already stopped, the restart isn't supported at the moment");
    }

    this.#stage = "running";

    // create remote report to publish files into
    if (this.#allureServiceClient && this.#publish) {
      const { url } = await this.#allureServiceClient.createReport({
        reportUuid: this.#reportUuid,
        reportName: this.#reportName,
      });

      this.#reportUrl = url;
    }

    await this.#eachPlugin(true, async (plugin, context) => {
      await plugin.start?.(context, this.#store, this.#events);
    });

    if (this.#realTime) {
      await this.#update();

      this.#events.onAll(async () => {
        await this.#update();
      });
    }
  };

  #update = async (): Promise<void> => {
    if (this.#stage !== "running") {
      return;
    }
    await this.#eachPlugin(false, async (plugin, context) => {
      await plugin.update?.(context, this.#store);
    });
  };

  done = async (): Promise<void> => {
    const summaries: PluginSummary[] = [];

    if (this.#stage !== "running") {
      throw new Error(initRequired);
    }

    this.#events.offAll();
    // closing it early, to prevent future reads
    this.#stage = "done";

    await this.#eachPlugin(false, async (plugin, context, { id, publish }) => {
      await plugin.done?.(context, this.#store);

      if (this.#allureServiceClient && publish) {
        const pluginFiles = (await context.state.get("files")) ?? {};

        for (const [filename, filepath] of Object.entries(pluginFiles)) {
          // publish data-files separately
          if (/^(data|widgets|index\.html$)/.test(filename)) {
            this.#allureServiceClient.addReportFile({
              reportUuid: this.#reportUuid,
              pluginId: id,
              filename,
              filepath,
            });
          } else {
            this.#allureServiceClient.addReportAsset({
              filename,
              filepath,
            });
          }
        }
      }

      const summary = await plugin?.info?.(context, this.#store);

      if (!summary) {
        return;
      }

      summaries.push({
        ...summary,
        href: `${id}/`,
      });
    });

    const outputDirFiles = await readdir(this.#output);

    // just do nothing if there is no reports in the output directory
    if (outputDirFiles.length === 0) {
      return;
    }

    const reportPath = join(this.#output, outputDirFiles[0]);
    const outputEntriesStats = await Promise.all(outputDirFiles.map((file) => lstat(join(this.#output, file))));
    const outputDirectoryEntries = outputEntriesStats.filter((entry) => entry.isDirectory());

    // if there is a single report directory in the output directory, move it to the root and prevent summary generation
    if (outputDirectoryEntries.length === 1) {
      const reportContent = await readdir(reportPath);

      for (const entry of reportContent) {
        const currentFilePath = join(reportPath, entry);
        const newFilePath = resolve(dirname(currentFilePath), "..", entry);

        await rename(currentFilePath, newFilePath);
      }

      await rm(reportPath, { recursive: true });
    }

    if (this.#history) {
      const testResults = await this.#store.allTestResults();
      const testCases = await this.#store.allTestCases();
      const historyDataPoint = createHistory(
        this.#reportUuid,
        this.#reportName,
        testCases,
        testResults,
        this.#reportUrl,
      );

      try {
        await this.#store.appendHistory(historyDataPoint);
      } catch (err) {
        if (err instanceof KnownError) {
          console.error("Failed to append history", err.message);
        } else if (err instanceof UnknownError) {
          // TODO: append log here? is it right to interact with the console here or we need to emit errors to the main process and render them outside?
          console.error("Failed to append history due to unexpected error", err.message);
        } else {
          throw err;
        }
      }
    }

    if (summaries.length > 1) {
      await generateSummary(this.#output, summaries);
    }

    if (this.#reportUrl) {
      console.info(`The report has been published: ${this.#reportUrl}`);
    }
  };

  #eachPlugin = async (
    initState: boolean,
    consumer: (plugin: Plugin, context: PluginContext, options: { id: string; publish: boolean }) => Promise<void>,
  ) => {
    if (initState) {
      // reset state on start;
      this.#state = {};
    }

    for (const { enabled, id, plugin, options } of this.#plugins) {
      if (!enabled) {
        continue;
      }

      const pluginState = this.#getPluginState(initState, id);

      if (!pluginState) {
        console.error("plugin error: state is empty");
        continue;
      }

      if (initState) {
        await pluginState.set("files", {});
      }

      const pluginFiles = new PluginFiles(this.#reportFiles, id, async (key, filepath) => {
        const currentPluginState = this.#getPluginState(false, id);
        const files: Record<string, string> | undefined = await currentPluginState?.get("files");

        if (!files) {
          return;
        }

        files[key] = filepath;
      });
      const pluginContext: PluginContext = {
        allureVersion: version,
        reportUuid: this.#reportUuid,
        reportName: this.#reportName,
        state: pluginState,
        reportFiles: pluginFiles,
      };

      try {
        await consumer.call(this, plugin, pluginContext, { id, publish: !!options?.publish });

        if (initState) {
          this.#state![id] = pluginState;
        }
      } catch (e) {
        console.error(`plugin ${id} error`, e);
      }
    }
  };

  #getPluginState(init: boolean, id: string) {
    return init ? new DefaultPluginState({}) : this.#state?.[id];
  }

  /**
   * Executes quality gate validation to make possible to receive exit code for the entire process
   */
  validate = async () => {
    await this.#qualityGate.validate(this.#store);
  };
}
