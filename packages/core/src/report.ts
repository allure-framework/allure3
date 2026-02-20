/* eslint max-lines: 0 */
import { detect } from "@allurereport/ci";
import type {
  AllureHistory,
  CategoryDefinition,
  CiDescriptor,
  KnownTestFailure,
  ReportVariables,
  TestResult,
} from "@allurereport/core-api";
import { normalizeCategoriesConfig } from "@allurereport/core-api";
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
import pLimit from "p-limit";
import ProgressBar from "progress";
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
  readonly #dump: string | undefined;
  readonly #categories: CategoryDefinition[];

  #dumpTempDirs: string[] = [];
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
      historyLimit,
      defaultLabels = {},
      variables = {},
      environment,
      environments,
      output,
      qualityGate,
      dump,
      categories,
      allureService: allureServiceConfig,
    } = opts;

    this.#allureServiceClient = allureServiceConfig?.accessToken
      ? new AllureServiceClient(allureServiceConfig)
      : undefined;
    this.reportUuid = randomUUID();
    this.#ci = detect();

    const reportTitleSuffix = this.#ci?.pullRequestName ?? this.#ci?.jobRunName;

    this.#reportName = [name, reportTitleSuffix].filter(Boolean).join(" – ");
    this.#reportVariables = variables;
    this.#eventEmitter = new EventEmitter<AllureStoreEvents>();
    this.#realtimeDispatcher = new RealtimeEventsDispatcher(this.#eventEmitter);
    this.#realtimeSubscriber = new RealtimeSubscriber(this.#eventEmitter);
    this.#realTime = realTime;
    this.#dump = dump;

    if (qualityGate) {
      this.#qualityGate = new QualityGate(qualityGate);
    }
    this.#categories = normalizeCategoriesConfig(categories);

    if (this.#allureServiceClient) {
      this.#history = new AllureRemoteHistory({
        limit: historyLimit,
        branch: this.#ci?.jobRunBranch,
        allureServiceClient: this.#allureServiceClient,
      });
    } else if (historyPath) {
      this.#history = new AllureLocalHistory({
        limit: historyLimit,
        historyPath,
      });
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
      } catch {}
    }
  };

  validate = async (params: {
    trs: TestResult[];
    knownIssues: KnownTestFailure[];
    state?: QualityGateState;
    environment?: string;
  }) => {
    const { trs, knownIssues, state, environment } = params;

    return this.#qualityGate!.validate({
      trs: trs.filter(Boolean),
      knownIssues,
      state,
      environment,
    });
  };

  start = async (): Promise<void> => {
    const branch = this.#ci?.jobRunBranch;

    await this.#store.readHistory();

    if (this.#executionStage === "running") {
      throw new Error("the report is already started");
    }

    if (this.#executionStage === "done") {
      throw new Error("the report is already stopped, the restart isn't supported at the moment");
    }

    this.#executionStage = "running";

    // create remote report to publish files into
    if (this.#allureServiceClient && this.#publish && branch) {
      const { url } = await this.#allureServiceClient.createReport({
        reportUuid: this.reportUuid,
        reportName: this.#reportName,
        branch,
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
      globalAttachmentIds = [],
      globalErrors = [],
      indexAttachmentByTestResult = {},
      indexTestResultByHistoryId = {},
      indexTestResultByTestCase = {},
      indexLatestEnvTestResultByHistoryId = {},
      indexAttachmentByFixture = {},
      indexFixturesByTestResult = {},
      indexKnownByHistoryId = {},
      qualityGateResults = [],
    } = this.#store.dumpState();
    const allAttachments = await this.#store.allAttachments();
    const dumpArchive = new ZipWriteStream({
      zlib: { level: 5 },
    });
    const addEntry = promisify(dumpArchive.entry.bind(dumpArchive));
    const dumpArchiveWriteStream = createWriteStream(`${this.#dump}.zip`);
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
    await addEntry(Buffer.from(JSON.stringify(globalAttachmentIds)), {
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
    await addEntry(Buffer.from(JSON.stringify(qualityGateResults)), {
      name: AllureStoreDumpFiles.QualityGateResults,
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

  restoreState = async (dumps: string[]): Promise<void> => {
    for (const dump of dumps) {
      if (!existsSync(dump)) {
        continue;
      }

      const dumpArchive = new ZipReadStream.async({
        file: dump,
      });
      const testResultsEntry = await dumpArchive.entryData(AllureStoreDumpFiles.TestResults);
      const testCasesEntry = await dumpArchive.entryData(AllureStoreDumpFiles.TestCases);
      const fixturesEntry = await dumpArchive.entryData(AllureStoreDumpFiles.Fixtures);
      const attachmentsEntry = await dumpArchive.entryData(AllureStoreDumpFiles.Attachments);
      const environmentsEntry = await dumpArchive.entryData(AllureStoreDumpFiles.Environments);
      const reportVariablesEntry = await dumpArchive.entryData(AllureStoreDumpFiles.ReportVariables);
      const globalAttachmentsEntry = await dumpArchive.entryData(AllureStoreDumpFiles.GlobalAttachments);
      const globalErrorsEntry = await dumpArchive.entryData(AllureStoreDumpFiles.GlobalErrors);
      const indexAttachmentsEntry = await dumpArchive.entryData(AllureStoreDumpFiles.IndexAttachmentsByTestResults);
      const indexTestResultsByHistoryId = await dumpArchive.entryData(AllureStoreDumpFiles.IndexTestResultsByHistoryId);
      const indexTestResultsByTestCaseEntry = await dumpArchive.entryData(
        AllureStoreDumpFiles.IndexTestResultsByTestCase,
      );
      const indexLatestEnvTestResultsByHistoryIdEntry = await dumpArchive.entryData(
        AllureStoreDumpFiles.IndexLatestEnvTestResultsByHistoryId,
      );
      const indexAttachmentsByFixtureEntry = await dumpArchive.entryData(
        AllureStoreDumpFiles.IndexAttachmentsByFixture,
      );
      const indexFixturesByTestResultEntry = await dumpArchive.entryData(
        AllureStoreDumpFiles.IndexFixturesByTestResult,
      );
      const indexKnownByHistoryIdEntry = await dumpArchive.entryData(AllureStoreDumpFiles.IndexKnownByHistoryId);
      const qualityGateResultsEntry = await dumpArchive.entryData(AllureStoreDumpFiles.QualityGateResults);

      const attachmentsEntries = Object.entries(await dumpArchive.entries()).reduce((acc, [entryName, entry]) => {
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
          case AllureStoreDumpFiles.QualityGateResults:
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
        globalAttachmentIds: JSON.parse(globalAttachmentsEntry.toString("utf8")),
        globalErrors: JSON.parse(globalErrorsEntry.toString("utf8")),
        indexAttachmentByTestResult: JSON.parse(indexAttachmentsEntry.toString("utf8")),
        indexTestResultByHistoryId: JSON.parse(indexTestResultsByHistoryId.toString("utf8")),
        indexTestResultByTestCase: JSON.parse(indexTestResultsByTestCaseEntry.toString("utf8")),
        indexLatestEnvTestResultByHistoryId: JSON.parse(indexLatestEnvTestResultsByHistoryIdEntry.toString("utf8")),
        indexAttachmentByFixture: JSON.parse(indexAttachmentsByFixtureEntry.toString("utf8")),
        indexFixturesByTestResult: JSON.parse(indexFixturesByTestResultEntry.toString("utf8")),
        indexKnownByHistoryId: JSON.parse(indexKnownByHistoryIdEntry.toString("utf8")),
        qualityGateResults: JSON.parse(qualityGateResultsEntry.toString("utf8")),
      };
      const dumpTempDir = await mkdtemp(join(tmpdir(), basename(dump, ".zip")));
      const resultsAttachments: Record<string, ResultFile> = {};

      this.#dumpTempDirs.push(dumpTempDir);

      try {
        for (const [attachmentId] of Object.entries(attachmentsEntries)) {
          const attachmentContentEntry = await dumpArchive.entryData(attachmentId);
          const attachmentFilePath = join(dumpTempDir, attachmentId);

          await writeFile(attachmentFilePath, attachmentContentEntry);

          resultsAttachments[attachmentId] = new PathResultFile(attachmentFilePath, attachmentId);
        }
      } catch (err) {
        console.error(`Can't restore state from "${dump}", continuing without it`);
        console.error(err);
      }

      await this.#store.restoreState(dumpState, resultsAttachments);

      console.info(`Successfully restored state from "${dump}"`);
    }
  };

  done = async (): Promise<void> => {
    const summaries: PluginSummary[] = [];
    const remoteHrefs: string[] = [];
    // track plugins that failed to upload to prevent wrong remote links generation
    const cancelledPluginsIds: Set<string> = new Set();

    if (this.#executionStage !== "running") {
      throw new Error(initRequired);
    }

    const testResults = await this.#store.allTestResults();
    const testCases = await this.#store.allTestCases();
    const historyDataPoint = createHistory(this.reportUuid, this.#reportName, testCases, testResults, this.reportUrl);

    this.#realtimeSubscriber.offAll();
    // closing it early, to prevent future reads
    this.#executionStage = "done";

    // just dump state when dump is set and generate nothing
    if (this.#dump) {
      await this.dumpState();
      return;
    }

    // isolate logs of different reports dumps: done and summary
    await this.#eachPlugin(false, async (plugin, context) => {
      await plugin.done?.(context, this.#store);
    });
    await this.#eachPlugin(false, async (plugin, context) => {
      // publish report files to the remote service
      if (this.#allureServiceClient && context.publish) {
        const pluginFiles = (await context.state.get("files")) ?? {};
        const pluginFilesEntries = Object.entries(pluginFiles);
        const progressBar =
          pluginFilesEntries?.length > 0
            ? new ProgressBar(`Publishing "${context.id}" report [:bar] :current/:total`, {
                total: pluginFilesEntries.length,
                width: 20,
              })
            : undefined;
        const limitFn = pLimit(50);
        const fns = pluginFilesEntries.map(([filename, filepath]) =>
          limitFn(async () => {
            // skip next plugin files upload if the plugin upload has already failed
            if (cancelledPluginsIds.has(context.id)) {
              return;
            }

            if (/^(data|widgets|index\.html$|summary\.json$)/.test(filename)) {
              await this.#allureServiceClient!.addReportFile({
                reportUuid: this.reportUuid,
                pluginId: context.id,
                filename,
                filepath,
              });
            } else {
              await this.#allureServiceClient!.addReportAsset({
                filename,
                filepath,
              });
            }

            progressBar?.tick?.();
          }),
        );

        progressBar?.render?.();

        try {
          await Promise.all(fns);
        } catch (err) {
          cancelledPluginsIds.add(context.id);

          // cleanup the report on failure to prevent incomplete reports on the server
          // even lack of one file can make the report unusable
          await this.#allureServiceClient.deleteReport({
            reportUuid: this.reportUuid,
            pluginId: context.id,
          });

          console.error(`Plugin "${context.id}" upload has failed, the plugin won't be published`);
          console.error(err);
        }
      }

      const summary = await plugin?.info?.(context, this.#store);

      if (!summary) {
        return;
      }

      summary.pullRequestHref = this.#ci?.pullRequestUrl;
      summary.jobHref = this.#ci?.jobRunUrl;

      if (context.publish && this.reportUrl && !cancelledPluginsIds.has(context.id)) {
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

    if (summaries.length > 1) {
      const summaryPath = await generateSummary(this.#output, summaries);
      const publishedReports = this.#plugins
        .map((plugin) => !!plugin?.options?.publish && !cancelledPluginsIds.has(plugin.id))
        .filter(Boolean);

      // publish summary when there are multiple published plugins
      if (this.#publish && summaryPath && publishedReports.length > 1) {
        await this.#allureServiceClient?.addReportFile({
          reportUuid: this.reportUuid,
          filename: "index.html",
          filepath: summaryPath,
        });
      }
    }

    if (this.#publish) {
      await this.#allureServiceClient?.completeReport({
        reportUuid: this.reportUuid,
        historyPoint: historyDataPoint,
      });
    }

    let outputDirFiles: string[] = [];

    try {
      // recursive flag is not applicable, it can provoke the process freeze
      outputDirFiles = await readdir(this.#output);
    } catch {}

    // just do nothing if there is no reports in the output directory
    if (outputDirFiles.length === 0) {
      return;
    }

    const reportPath = join(this.#output, outputDirFiles[0]);
    const reportStats = await lstat(reportPath);
    const outputEntriesStats = await Promise.all(outputDirFiles.map((file) => lstat(join(this.#output, file))));
    const outputDirectoryEntries = outputEntriesStats.filter((entry) => entry.isDirectory());

    // if there is a single report directory in the output directory, move it to the root and prevent summary generation
    if (reportStats.isDirectory() && outputDirectoryEntries.length === 1) {
      const reportContent = await readdir(reportPath);

      for (const entry of reportContent) {
        const currentFilePath = join(reportPath, entry);
        const newFilePath = resolve(dirname(currentFilePath), "..", entry);

        await rename(currentFilePath, newFilePath);
      }

      await rm(reportPath, { recursive: true });
    }

    // remove all dump temp dirs
    for (const dir of this.#dumpTempDirs) {
      try {
        await rm(dir, { recursive: true });
      } catch {}
    }

    if (this.#history) {
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

    if (remoteHrefs.length > 0) {
      console.info("Next reports have been published:");

      remoteHrefs.forEach((href) => {
        console.info(`- ${href}`);
      });
    }

    if (!this.#qualityGate) {
      return;
    }

    const qualityGateResults = await this.#store.qualityGateResultsByEnv();

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
        reportUrl: this.reportUrl,
        output: this.#output,
        ci: this.#ci,
        categories: this.#categories,
        history: this.#history,
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
