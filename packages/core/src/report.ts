import { detect } from "@allurereport/ci";
import type {
  AllureHistory,
  CiDescriptor,
  KnownTestFailure,
  ReportVariables,
  TestResult,
} from "@allurereport/core-api";
import {
  type AllureStoreDump,
  AllureStoreDumpFiles,
  type Plugin,
  type PluginContext,
  type PluginState,
  type PluginSummary,
  type ReportFiles,
  type ResultFile,
} from "@allurereport/plugin-api";
import { allure1, allure2, attachments, cucumberjson, junitXml, readXcResultBundle } from "@allurereport/reader";
import { PathResultFile, type ResultsReader } from "@allurereport/reader-api";
import { AllureRemoteHistory, AllureServiceClient, KnownError, UnknownError } from "@allurereport/service";
import { generateSummary } from "@allurereport/summary";
import ZipReadStream from "node-stream-zip";
import console from "node:console";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createReadStream, createWriteStream, existsSync, readFileSync } from "node:fs";
import { lstat, mkdtemp, opendir, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import ZipWriteStream from "zip-stream";
import type { FullConfig, PluginInstance } from "./api.js";
import { AllureLocalHistory, createHistory } from "./history.js";
import { DefaultPluginState, PluginFiles } from "./plugin.js";
import { QualityGate, type QualityGateState } from "./qualityGate/index.js";
import { DefaultAllureStore } from "./store/store.js";
import { type AllureStoreEvents, RealtimeEventsDispatcher, RealtimeSubscriber } from "./utils/event.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const initRequired = "report is not initialised. Call the start() method first.";

export class AllureReport {
  readonly #reportName: string;
  readonly #reportVariables: ReportVariables;
  readonly #ci: CiDescriptor | undefined;
  readonly #store: DefaultAllureStore;
  readonly #readers: readonly ResultsReader[];
  readonly #plugins: readonly PluginInstance[];
  readonly #reportFiles: ReportFiles;
  readonly #eventEmitter: EventEmitter<AllureStoreEvents>;
  readonly #realtimeSubscriber: RealtimeSubscriber;
  readonly #realtimeDispatcher: RealtimeEventsDispatcher;
  readonly #realTime: any;
  readonly #output: string;
  readonly #history: AllureHistory | undefined;
  readonly #allureServiceClient: AllureServiceClient | undefined;
  readonly #qualityGate: QualityGate | undefined;
  readonly #stage: string | undefined;

  #stageTempDirs: string[] = [];
  #state?: Record<string, PluginState>;
  #executionStage: "init" | "running" | "done" = "init";

  readonly reportUuid: string;
  reportUrl?: string;

  constructor(opts: FullConfig) {
    const {
      name,
      readers = [allure1, allure2, cucumberjson, junitXml, attachments],
      plugins = [],
      known,
      reportFiles,
      realTime,
      historyPath,
      defaultLabels = {},
      variables = {},
      environment,
      environments,
      output,
      qualityGate,
      stage,
      allureService: allureServiceConfig,
    } = opts;

    this.#allureServiceClient = allureServiceConfig?.url ? new AllureServiceClient(allureServiceConfig) : undefined;
    this.reportUuid = randomUUID();
    this.#ci = detect();

    const reportTitleSuffix = this.#ci?.pullRequestName ?? this.#ci?.jobRunName;

    this.#reportName = [name, reportTitleSuffix].filter(Boolean).join(" – ");
    this.#reportVariables = variables;
    this.#eventEmitter = new EventEmitter<AllureStoreEvents>();
    this.#realtimeDispatcher = new RealtimeEventsDispatcher(this.#eventEmitter);
    this.#realtimeSubscriber = new RealtimeSubscriber(this.#eventEmitter);
    this.#realTime = realTime;
    this.#stage = stage;

    if (this.#allureServiceClient) {
      this.#history = new AllureRemoteHistory(this.#allureServiceClient);
    } else if (historyPath) {
      this.#history = new AllureLocalHistory(historyPath);
    }

    if (qualityGate) {
      this.#qualityGate = new QualityGate(qualityGate);
    }

    this.#store = new DefaultAllureStore({
      realtimeSubscriber: this.#realtimeSubscriber,
      realtimeDispatcher: this.#realtimeDispatcher,
      reportVariables: variables,
      environmentsConfig: environments,
      history: this.#history,
      known,
      defaultLabels,
      environment,
    });
    this.#readers = [...readers];
    this.#plugins = [...plugins];
    this.#reportFiles = reportFiles;
    this.#output = output;
    this.#history = this.#allureServiceClient
      ? new AllureRemoteHistory(this.#allureServiceClient)
      : new AllureLocalHistory(historyPath);
  }

  get hasQualityGate() {
    return !!this.#qualityGate;
  }

  get store(): DefaultAllureStore {
    return this.#store;
  }

  get realtimeSubscriber(): RealtimeSubscriber {
    return this.#realtimeSubscriber;
  }

  get realtimeDispatcher(): RealtimeEventsDispatcher {
    return this.#realtimeDispatcher;
  }

  get #publish() {
    return this.#plugins.some(({ enabled, options }) => enabled && options.publish);
  }

  readDirectory = async (resultsDir: string) => {
    if (this.#executionStage !== "running") {
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
    if (this.#executionStage !== "running") {
      throw new Error(initRequired);
    }
    await this.readResult(new PathResultFile(resultsFile));
  };

  readResult = async (data: ResultFile) => {
    if (this.#executionStage !== "running") {
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

  validate = async (params: { trs: TestResult[]; knownIssues: KnownTestFailure[]; state?: QualityGateState }) => {
    const { trs, knownIssues, state } = params;

    return this.#qualityGate!.validate({
      trs: trs.filter(Boolean),
      knownIssues,
      state,
    });
  };

  start = async (): Promise<void> => {
    await this.#store.readHistory();

    if (this.#executionStage === "running") {
      throw new Error("the report is already started");
    }

    if (this.#executionStage === "done") {
      throw new Error("the report is already stopped, the restart isn't supported at the moment");
    }

    this.#executionStage = "running";

    // create remote report to publish files into
    if (this.#allureServiceClient && this.#publish) {
      const { url } = await this.#allureServiceClient.createReport({
        reportUuid: this.reportUuid,
        reportName: this.#reportName,
      });

      this.reportUrl = url;
    }

    await this.#eachPlugin(true, async (plugin, context) => {
      await plugin.start?.(context, this.#store, this.#realtimeSubscriber);
    });

    if (this.#realTime) {
      await this.#update();

      this.#realtimeSubscriber.onAll(async () => {
        await this.#update();
      });
    }
  };

  #update = async (): Promise<void> => {
    if (this.#executionStage !== "running") {
      return;
    }
    await this.#eachPlugin(false, async (plugin, context) => {
      await plugin.update?.(context, this.#store);
    });
  };

  dumpState = async (): Promise<void> => {
    const {
      testResults,
      testCases,
      fixtures,
      attachments: attachmentsLinks,
      environments,
      globalAttachments = [],
      globalErrors = [],
      indexAttachmentByTestResult = {},
      indexTestResultByHistoryId = {},
      indexTestResultByTestCase = {},
      indexLatestEnvTestResultByHistoryId = {},
      indexAttachmentByFixture = {},
      indexFixturesByTestResult = {},
      indexKnownByHistoryId = {},
    } = this.#store.dumpState();
    const allAttachments = await this.#store.allAttachments();
    const dumpArchive = new ZipWriteStream({
      zlib: { level: 5 },
    });
    const addEntry = promisify(dumpArchive.entry.bind(dumpArchive));
    const dumpArchiveWriteStream = createWriteStream(`${this.#stage}.zip`);
    const promise = new Promise((res, rej) => {
      dumpArchive.on("error", (err) => rej(err));
      dumpArchiveWriteStream.on("finish", () => res(void 0));
      dumpArchiveWriteStream.on("error", (err) => rej(err));
    });

    dumpArchive.pipe(dumpArchiveWriteStream);

    await addEntry(Buffer.from(JSON.stringify(testResults)), {
      name: AllureStoreDumpFiles.TestResults,
    });
    await addEntry(Buffer.from(JSON.stringify(testCases)), {
      name: AllureStoreDumpFiles.TestCases,
    });
    await addEntry(Buffer.from(JSON.stringify(fixtures)), {
      name: AllureStoreDumpFiles.Fixtures,
    });
    await addEntry(Buffer.from(JSON.stringify(attachmentsLinks)), {
      name: AllureStoreDumpFiles.Attachments,
    });
    await addEntry(Buffer.from(JSON.stringify(environments)), {
      name: AllureStoreDumpFiles.Environments,
    });
    await addEntry(Buffer.from(JSON.stringify(this.#reportVariables)), {
      name: AllureStoreDumpFiles.ReportVariables,
    });
    await addEntry(Buffer.from(JSON.stringify(globalAttachments)), {
      name: AllureStoreDumpFiles.GlobalAttachments,
    });
    await addEntry(Buffer.from(JSON.stringify(globalErrors)), {
      name: AllureStoreDumpFiles.GlobalErrors,
    });
    await addEntry(Buffer.from(JSON.stringify(indexAttachmentByTestResult)), {
      name: AllureStoreDumpFiles.IndexAttachmentsByTestResults,
    });
    await addEntry(Buffer.from(JSON.stringify(indexTestResultByHistoryId)), {
      name: AllureStoreDumpFiles.IndexTestResultsByHistoryId,
    });
    await addEntry(Buffer.from(JSON.stringify(indexTestResultByTestCase)), {
      name: AllureStoreDumpFiles.IndexTestResultsByTestCase,
    });
    await addEntry(Buffer.from(JSON.stringify(indexLatestEnvTestResultByHistoryId)), {
      name: AllureStoreDumpFiles.IndexLatestEnvTestResultsByHistoryId,
    });
    await addEntry(Buffer.from(JSON.stringify(indexAttachmentByFixture)), {
      name: AllureStoreDumpFiles.IndexAttachmentsByFixture,
    });
    await addEntry(Buffer.from(JSON.stringify(indexFixturesByTestResult)), {
      name: AllureStoreDumpFiles.IndexFixturesByTestResult,
    });
    await addEntry(Buffer.from(JSON.stringify(indexKnownByHistoryId)), {
      name: AllureStoreDumpFiles.IndexKnownByHistoryId,
    });

    for (const attachment of allAttachments) {
      const content = await this.#store.attachmentContentById(attachment.id);

      if (!content) {
        continue;
      }

      if (content instanceof PathResultFile) {
        await addEntry(createReadStream(content.path), {
          name: attachment.id,
        });
      } else {
        await addEntry(await content.asBuffer(), {
          name: attachment.id,
        });
      }
    }

    dumpArchive.finalize();

    return promise as Promise<void>;
  };

  restoreState = async (stages: string[]): Promise<void> => {
    for (const stage of stages) {
      if (!existsSync(stage)) {
        continue;
      }

      const dump = new ZipReadStream.async({
        file: stage,
      });

      const testResultsEntry = await dump.entryData(AllureStoreDumpFiles.TestResults);
      const testCasesEntry = await dump.entryData(AllureStoreDumpFiles.TestCases);
      const fixturesEntry = await dump.entryData(AllureStoreDumpFiles.Fixtures);
      const attachmentsEntry = await dump.entryData(AllureStoreDumpFiles.Attachments);
      const environmentsEntry = await dump.entryData(AllureStoreDumpFiles.Environments);
      const reportVariablesEntry = await dump.entryData(AllureStoreDumpFiles.ReportVariables);
      const globalAttachmentsEntry = await dump.entryData(AllureStoreDumpFiles.GlobalAttachments);
      const globalErrorsEntry = await dump.entryData(AllureStoreDumpFiles.GlobalErrors);
      const indexAttachmentsEntry = await dump.entryData(AllureStoreDumpFiles.IndexAttachmentsByTestResults);
      const indexTestResultsByHistoryId = await dump.entryData(AllureStoreDumpFiles.IndexTestResultsByHistoryId);
      const indexTestResultsByTestCaseEntry = await dump.entryData(AllureStoreDumpFiles.IndexTestResultsByTestCase);
      const indexLatestEnvTestResultsByHistoryIdEntry = await dump.entryData(
        AllureStoreDumpFiles.IndexLatestEnvTestResultsByHistoryId,
      );
      const indexAttachmentsByFixtureEntry = await dump.entryData(AllureStoreDumpFiles.IndexAttachmentsByFixture);
      const indexFixturesByTestResultEntry = await dump.entryData(AllureStoreDumpFiles.IndexFixturesByTestResult);
      const indexKnownByHistoryIdEntry = await dump.entryData(AllureStoreDumpFiles.IndexKnownByHistoryId);
      const attachmentsEntries = Object.entries(await dump.entries()).reduce((acc, [entryName, entry]) => {
        switch (entryName) {
          case AllureStoreDumpFiles.Attachments:
          case AllureStoreDumpFiles.TestResults:
          case AllureStoreDumpFiles.TestCases:
          case AllureStoreDumpFiles.Fixtures:
          case AllureStoreDumpFiles.Environments:
          case AllureStoreDumpFiles.ReportVariables:
          case AllureStoreDumpFiles.GlobalAttachments:
          case AllureStoreDumpFiles.GlobalErrors:
          case AllureStoreDumpFiles.IndexAttachmentsByTestResults:
          case AllureStoreDumpFiles.IndexTestResultsByHistoryId:
          case AllureStoreDumpFiles.IndexTestResultsByTestCase:
          case AllureStoreDumpFiles.IndexLatestEnvTestResultsByHistoryId:
          case AllureStoreDumpFiles.IndexAttachmentsByFixture:
          case AllureStoreDumpFiles.IndexFixturesByTestResult:
          case AllureStoreDumpFiles.IndexKnownByHistoryId:
            return acc;
          default:
            return Object.assign(acc, {
              [entryName]: entry,
            });
        }
      }, {});
      const dumpState: AllureStoreDump = {
        testResults: JSON.parse(testResultsEntry.toString("utf8")),
        testCases: JSON.parse(testCasesEntry.toString("utf8")),
        fixtures: JSON.parse(fixturesEntry.toString("utf8")),
        attachments: JSON.parse(attachmentsEntry.toString("utf8")),
        environments: JSON.parse(environmentsEntry.toString("utf8")),
        reportVariables: JSON.parse(reportVariablesEntry.toString("utf8")),
        globalAttachments: JSON.parse(globalAttachmentsEntry.toString("utf8")),
        globalErrors: JSON.parse(globalErrorsEntry.toString("utf8")),
        indexAttachmentByTestResult: JSON.parse(indexAttachmentsEntry.toString("utf8")),
        indexTestResultByHistoryId: JSON.parse(indexTestResultsByHistoryId.toString("utf8")),
        indexTestResultByTestCase: JSON.parse(indexTestResultsByTestCaseEntry.toString("utf8")),
        indexLatestEnvTestResultByHistoryId: JSON.parse(indexLatestEnvTestResultsByHistoryIdEntry.toString("utf8")),
        indexAttachmentByFixture: JSON.parse(indexAttachmentsByFixtureEntry.toString("utf8")),
        indexFixturesByTestResult: JSON.parse(indexFixturesByTestResultEntry.toString("utf8")),
        indexKnownByHistoryId: JSON.parse(indexKnownByHistoryIdEntry.toString("utf8")),
      };
      const stageTempDir = await mkdtemp(join(tmpdir(), basename(stage, ".zip")));
      const resultsAttachments: Record<string, ResultFile> = {};

      this.#stageTempDirs.push(stageTempDir);

      try {
        for (const [attachmentId] of Object.entries(attachmentsEntries)) {
          const attachmentContentEntry = await dump.entryData(attachmentId);
          const attachmentFilePath = join(stageTempDir, attachmentId);

          await writeFile(attachmentFilePath, attachmentContentEntry);

          resultsAttachments[attachmentId] = new PathResultFile(attachmentFilePath, attachmentId);
        }
      } catch (err) {
        console.error(`Can't restore state from "${stage}", continuing without it`);
        console.error(err);
      }

      await this.#store.restoreState(dumpState, resultsAttachments);
    }
  };

  done = async (): Promise<void> => {
    const summaries: PluginSummary[] = [];
    const remoteHrefs: string[] = [];

    if (this.#executionStage !== "running") {
      throw new Error(initRequired);
    }

    this.#realtimeSubscriber.offAll();
    // closing it early, to prevent future reads
    this.#executionStage = "done";

    // just dump state when stage is set and generate nothing
    if (this.#stage) {
      await this.dumpState();
      return;
    }

    await this.#eachPlugin(false, async (plugin, context) => {
      await plugin.done?.(context, this.#store);

      if (this.#allureServiceClient && context.publish) {
        const pluginFiles = (await context.state.get("files")) ?? {};

        for (const [filename, filepath] of Object.entries(pluginFiles)) {
          // publish data-files separately
          if (/^(data|widgets|index\.html$)/.test(filename)) {
            await this.#allureServiceClient.addReportFile({
              reportUuid: this.reportUuid,
              pluginId: context.id,
              filename,
              filepath,
            });
          } else {
            await this.#allureServiceClient.addReportAsset({
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

      summary.pullRequestHref = this.#ci?.pullRequestUrl;
      summary.jobHref = this.#ci?.jobRunUrl;

      if (context.publish) {
        summary.remoteHref = `${this.reportUrl}/${context.id}/`;

        remoteHrefs.push(summary.remoteHref);
      }

      summaries.push({
        ...summary,
        href: `${context.id}/`,
      });

      // expose summary.json file to the FS to make possible to use it in the integrations
      await context.reportFiles.addFile("summary.json", Buffer.from(JSON.stringify(summary)));
    });

    if (this.#publish) {
      await this.#allureServiceClient?.completeReport({
        reportUuid: this.reportUuid,
      });
    }

    let outputDirFiles: string[] = [];

    try {
      // recursive flag is not applicable, it can provoke the process freeze
      outputDirFiles = await readdir(this.#output);
    } catch (ignored) {}

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

    // remove all stage dump temp dirs
    for (const dir of this.#stageTempDirs) {
      try {
        await rm(dir, { recursive: true });
      } catch (ignored) {}
    }

    if (this.#history) {
      const testResults = await this.#store.allTestResults();
      const testCases = await this.#store.allTestCases();
      const historyDataPoint = createHistory(this.reportUuid, this.#reportName, testCases, testResults, this.reportUrl);

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

    if (remoteHrefs.length > 0) {
      console.info("Next reports have been published:");

      remoteHrefs.forEach((href) => {
        console.info(`- ${href}`);
      });
    }

    if (!this.#qualityGate) {
      return;
    }

    const qualityGateResults = await this.#store.qualityGateResults();

    await writeFile(join(this.#output, "quality-gate.json"), JSON.stringify(qualityGateResults));
  };

  #eachPlugin = async (initState: boolean, consumer: (plugin: Plugin, context: PluginContext) => Promise<void>) => {
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
        id,
        publish: !!options?.publish,
        allureVersion: version,
        reportUuid: this.reportUuid,
        reportName: this.#reportName,
        state: pluginState,
        reportFiles: pluginFiles,
        ci: this.#ci,
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
}
