import type { Plugin, PluginContext, PluginState, ReportFiles, ResultFile } from "@allurereport/plugin-api";
import { allure1, allure2, attachments, cucumberjson, junitXml } from "@allurereport/reader";
import { PathResultFile, type ResultsReader } from "@allurereport/reader-api";
import console from "node:console";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { opendir, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FullConfig, PluginInstance } from "./api.js";
import { createHistory, writeHistory } from "./history.js";
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
  readonly #appendHistory: boolean;
  readonly #historyPath: string;
  readonly #realTime: any;
  #state?: Record<string, PluginState>;
  #stage: "init" | "running" | "done" = "init";

  constructor(opts: FullConfig) {
    const {
      name,
      readers = [allure1, allure2, cucumberjson, junitXml, attachments],
      plugins = [],
      history,
      known,
      reportFiles,
      qualityGate,
      realTime,
      appendHistory,
      historyPath,
      defaultLabels = {},
      variables = {},
      environments,
    } = opts;
    this.#reportUuid = randomUUID();
    this.#reportName = name;
    this.#eventEmitter = new EventEmitter<AllureStoreEvents>();
    this.#events = new Events(this.#eventEmitter);
    this.#realTime = realTime;
    this.#appendHistory = appendHistory ?? true;
    this.#historyPath = historyPath;
    this.#store = new DefaultAllureStore({
      eventEmitter: this.#eventEmitter,
      reportVariables: variables,
      environmentsConfig: environments,
      history,
      known,
      defaultLabels,
    });
    this.#readers = [...readers];
    this.#plugins = [...plugins];
    this.#reportFiles = reportFiles;

    // TODO: where should we execute quality gate?
    this.#qualityGate = new QualityGate(qualityGate);
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

  readDirectory = async (resultsDir: string) => {
    if (this.#stage !== "running") {
      throw new Error(initRequired);
    }

    const resultsDirPath = resolve(resultsDir);
    const dir = await opendir(resultsDirPath);

    try {
      for await (const dirent of dir) {
        if (dirent.isFile()) {
          const path = await realpath(join(dirent.parentPath, dirent.name));

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
    if (this.#stage === "running") {
      throw new Error("the report is already started");
    }
    if (this.#stage === "done") {
      throw new Error("the report is already stopped, the restart isn't supported at the moment");
    }
    this.#stage = "running";

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
    if (this.#stage !== "running") {
      throw new Error(initRequired);
    }
    this.#events.offAll();
    // closing it early, to prevent future reads
    this.#stage = "done";

    await this.#eachPlugin(false, async (plugin, context) => {
      await plugin.done?.(context, this.#store);
    });

    if (this.#appendHistory) {
      const testResults = await this.#store.allTestResults();
      const testCases = await this.#store.allTestCases();
      const historyDataPoint = createHistory(this.#reportUuid, this.#reportName, testCases, testResults);
      await writeHistory(this.#historyPath, historyDataPoint);
    }
  };

  #eachPlugin = async (initState: boolean, consumer: (plugin: Plugin, context: PluginContext) => Promise<void>) => {
    if (initState) {
      // reset state on start;
      this.#state = {};
    }

    for (const descriptor of this.#plugins) {
      if (!descriptor.enabled) {
        continue;
      }

      const id = descriptor.id;
      const plugin = descriptor.plugin;
      const pluginState = this.#getPluginState(initState, id);

      if (!pluginState) {
        console.error("plugin error: state is empty");
        continue;
      }

      const pluginFiles = new PluginFiles(this.#reportFiles, id);
      const pluginContext: PluginContext = {
        allureVersion: version,
        reportUuid: this.#reportUuid,
        reportName: this.#reportName,
        state: pluginState,
        reportFiles: pluginFiles,
      };

      try {
        await consumer.call(this, plugin, pluginContext);

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
