import console from "node:console";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createReadStream, createWriteStream, existsSync, readFileSync, type ReadStream } from "node:fs";
import { lstat, mkdtemp, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";

/* eslint max-lines: 0 */
import { detect } from "@allurereport/ci";
import type {
  AllureHistory,
  CategoryDefinition,
  CiDescriptor,
  HistoryDataPoint,
  KnownTestFailure,
  TestResult,
} from "@allurereport/core-api";
import { normalizeCategoriesConfig } from "@allurereport/core-api";
import {
  type AllureStoreDump,
  AllureStoreDumpFiles,
  type Plugin,
  type PluginContext,
  type PluginReportFile,
  type PluginState,
  type PluginSummary,
  type ReportFiles,
  type ResultFile,
} from "@allurereport/plugin-api";
import { allure1, allure2, attachments, cucumberjson, junitXml, readXcResultBundle } from "@allurereport/reader";
import { PathResultFile, type ResultsReader } from "@allurereport/reader-api";
import {
  AllureRemoteHistory,
  AllureServiceClient,
  AllureTestOpsClient,
  type AllureServiceApiClient,
  KnownError,
  UnknownError,
} from "@allurereport/service";
import { generateSummary } from "@allurereport/summary";
import { glob } from "glob";
import ZipReadStream from "node-stream-zip";
import pLimit from "p-limit";
import ZipWriteStream from "zip-stream";

import type { FullConfig, PluginInstance } from "./api.js";
import { AllureLocalHistory, createHistory } from "./history.js";
import { writeQuarantine } from "./known.js";
import { DefaultPluginState, PluginFiles } from "./plugin.js";
import { QualityGate, type QualityGateState } from "./qualityGate/index.js";
import { DefaultAllureStore } from "./store/store.js";
import { environmentIdentityById, environmentIdentityByName } from "./utils/environment.js";
import { RealtimeEventsDispatcher, RealtimeSubscriber } from "./utils/event.js";
import { measurePerf, PERF_METRIC_NAMES, PERF_METRIC_PREFIXES, startPerfSpan, writePerfMetrics } from "./utils/perf.js";
import { RealtimeChannel } from "./utils/realtimeChannel.js";
import { RealtimeUpdateScheduler } from "./utils/realtimeUpdateScheduler.js";
import { resolveDumpAttachmentPath, UnsafeDumpPathError } from "./utils/safeDumpPath.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const INIT_REQUIRED_ERROR_MESSAGE = "report is not initialised. Call the start() method first.";
const DEFAULT_READ_CONCURRENCY = 64;
const MAX_READ_CONCURRENCY = 256;

const readConcurrency = () => {
  const parsed = Number.parseInt(process.env.ALLURE_READ_CONCURRENCY ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_READ_CONCURRENCY;
  }

  return Math.min(MAX_READ_CONCURRENCY, Math.max(1, parsed));
};

const clonePluginSummary = (summary: PluginSummary): PluginSummary => structuredClone(summary);

const remoteReportParams = (ci: CiDescriptor | undefined): { repo?: string; branch?: string } => {
  const repo = ci?.repoName;
  const branch = ci?.jobRunBranch;

  return repo && branch ? { repo, branch } : {};
};

const errorDetails = (err: unknown): string => (err instanceof Error ? (err.stack ?? err.message) : String(err));

const closeReadStream = async (stream: ReadStream): Promise<void> => {
  if (stream.closed) {
    return;
  }

  const closed = once(stream, "close").then(() => undefined);

  if (!stream.destroyed) {
    stream.destroy();
  }

  await closed.catch(() => undefined);
};

export class AllureReport {
  readonly #ci: CiDescriptor | undefined;
  readonly #store: DefaultAllureStore;
  readonly #readers: readonly ResultsReader[];
  readonly #plugins: readonly PluginInstance[];
  readonly #reportFiles: ReportFiles;
  readonly #realtimeChannel: RealtimeChannel;
  readonly #realtimeUpdateScheduler: RealtimeUpdateScheduler;
  readonly #realTime: any;
  readonly #hideLabels: FullConfig["hideLabels"];
  readonly #output: string;
  readonly #history: AllureHistory | undefined;
  readonly #appendHistory: boolean;
  readonly #quarantinePath?: string;
  readonly #allureServiceClient: AllureServiceApiClient | undefined;
  readonly #qualityGate: QualityGate | undefined;
  readonly #dump: string | undefined;
  readonly #categories: CategoryDefinition[];
  readonly #environments: NonNullable<FullConfig["environments"]>;
  readonly #globalAttachments: FullConfig["globalAttachments"];

  #dumpTempDirs: string[] = [];
  #state?: Record<string, PluginState>;
  #executionStage: "init" | "running" | "done" = "init";
  #historyDataPoint?: HistoryDataPoint;
  #summaryPath?: string;
  #summariesByPluginId: Map<string, PluginSummary> = new Map();
  #publishedRemoteHrefs: Set<string> = new Set();
  #published = false;
  #endGeneratePerfSpan?: () => void;

  readonly reportUuid: string;
  readonly reportName: string;
  reportUrl?: string;

  constructor(opts: FullConfig) {
    const {
      name,
      readers = [allure1, allure2, cucumberjson, junitXml, attachments],
      plugins = [],
      known,
      quarantine,
      quarantinePath,
      reportFiles,
      realTime,
      historyPath,
      historyLimit,
      appendHistory,
      defaultLabels = {},
      variables = {},
      environment,
      allowedEnvironments,
      environments,
      output,
      hideLabels,
      qualityGate,
      dump,
      categories,
      allureService,
      globalAttachments,
    } = opts;
    const allureServiceAccessToken = allureService?.accessToken;

    if (allureServiceAccessToken) {
      const allureServiceClientConfig = {
        ...allureService,
        accessToken: allureServiceAccessToken,
      };

      this.#allureServiceClient = allureServiceAccessToken.startsWith("ato1.")
        ? new AllureTestOpsClient(allureServiceClientConfig)
        : allureServiceAccessToken.startsWith("ars1.")
          ? new AllureServiceClient(allureServiceClientConfig)
          : undefined;
    }

    this.reportUuid = randomUUID();
    this.#ci = detect();

    const reportTitleSuffix = this.#ci?.pullRequestName ?? this.#ci?.jobRunName;

    this.reportName = [name, reportTitleSuffix].filter(Boolean).join(" – ");
    this.#realtimeChannel = new RealtimeChannel();
    this.#realtimeUpdateScheduler = new RealtimeUpdateScheduler(this.#runRealtimeUpdate);
    this.#realTime = realTime;
    this.#dump = dump;
    this.#hideLabels = hideLabels;
    this.#environments = environments ?? {};
    this.#globalAttachments = globalAttachments;
    this.#appendHistory = appendHistory ?? true;
    this.#quarantinePath = quarantinePath;

    if (qualityGate) {
      this.#qualityGate = new QualityGate(qualityGate);
    }

    this.#categories = normalizeCategoriesConfig(categories);

    if (this.#allureServiceClient) {
      this.#history = new AllureRemoteHistory({
        limit: historyLimit,
        ...remoteReportParams(this.#ci),
        allureServiceClient: this.#allureServiceClient,
      });
    } else if (historyPath) {
      this.#history = new AllureLocalHistory({
        limit: historyLimit,
        historyPath,
      });
    }

    this.#store = new DefaultAllureStore({
      realtimeSubscriber: this.#realtimeChannel.subscriber,
      realtimeDispatcher: this.#realtimeChannel.dispatcher,
      reportVariables: variables,
      environmentsConfig: environments,
      history: this.#history,
      known,
      quarantine,
      defaultLabels,
      environment,
      allowedEnvironments,
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
    return this.#realtimeChannel.subscriber;
  }

  get realtimeDispatcher(): RealtimeEventsDispatcher {
    return this.#realtimeChannel.dispatcher;
  }

  #publish = async (): Promise<void> => {
    if (this.#published) {
      return;
    }

    if (this.#executionStage !== "done") {
      throw new Error("report is not completed. Call the done() method first.");
    }

    let historyPoint = this.#historyDataPoint;

    if (!historyPoint) {
      const allTrs = await this.#store.allTestResults();
      const allTcs = await this.#store.allTestCases();

      historyPoint = createHistory(this.reportUuid, this.reportName, allTcs, allTrs, this.reportUrl);
      this.#historyDataPoint = historyPoint;
    }

    await this.#writeSummaryFiles();
    await this.#generateRootSummary();

    if (this.#realTime || !this.#allureServiceClient) {
      this.#published = true;
      return;
    }

    const reportsToPublish = (await this.#getReportsToPublish()).filter(
      (report) => report.publish && Object.keys(report.files).length > 0,
    );

    if (reportsToPublish.length === 0) {
      this.#published = true;
      return;
    }

    const client = this.#allureServiceClient;
    const linksByPluginId: Record<string, string> = {};
    const summariesSnapshot = this.#cloneSummariesByPluginId();
    const uploadProgressMessage =
      reportsToPublish.length === 1 ? `Publishing "${reportsToPublish[0].pluginId}" report` : "Publishing reports";
    const totalFilesToUpload = reportsToPublish.reduce((acc, report) => acc + Object.keys(report.files).length, 0);
    const progressStep = Math.max(1, Math.ceil(totalFilesToUpload / 20));
    let summariesMutated = false;
    let reportCreated = false;
    let publishErrorMessage = "Report upload has failed, the report won't be published";
    let uploadedFiles = 0;
    let nextProgressLogAt = 0;
    let lastProgressLog = -1;
    const endPublishPerfSpan = startPerfSpan(PERF_METRIC_NAMES.publishUploadTotal);
    const logUploadProgress = (force = false) => {
      if (force && uploadedFiles === lastProgressLog) {
        return;
      }

      if (!force && uploadedFiles < nextProgressLogAt && uploadedFiles !== totalFilesToUpload) {
        return;
      }

      if (!force && uploadedFiles === lastProgressLog) {
        return;
      }

      console.info(`[AllureReport]: ${uploadProgressMessage}: ${uploadedFiles}/${totalFilesToUpload} files uploaded`);

      lastProgressLog = uploadedFiles;
      nextProgressLogAt = Math.min(totalFilesToUpload, uploadedFiles + progressStep);
    };
    const incrementUploadProgress = (delta = 1) => {
      uploadedFiles = Math.min(totalFilesToUpload, uploadedFiles + delta);
      logUploadProgress();
    };

    try {
      logUploadProgress(true);

      await client.createReport({
        reportUuid: this.reportUuid,
        reportName: this.reportName,
        ...remoteReportParams(this.#ci),
      });

      reportCreated = true;

      for (const report of reportsToPublish) {
        publishErrorMessage = `Plugin "${report.pluginId}" upload has failed, the plugin won't be published`;
        const reportFiles = Object.fromEntries(
          Object.entries(report.files).filter(([filename]) => filename !== "summary.json"),
        ) as Record<string, string>;

        const uploadResult = await measurePerf(`${PERF_METRIC_PREFIXES.publishUploadPlugin}${report.pluginId}`, () =>
          client.uploadReport({
            reportUuid: this.reportUuid,
            pluginId: report.pluginId,
            files: reportFiles,
            onProgress: incrementUploadProgress,
          }),
        );

        if (uploadResult.indexHref) {
          linksByPluginId[report.pluginId] = uploadResult.indexHref;
        }
      }

      const changedPluginIds = this.#applyPublishLinksToSummaries(linksByPluginId);

      summariesMutated = changedPluginIds.size > 0;

      if (changedPluginIds.size > 0) {
        await this.#writeSummaryFiles();
        await this.#generateRootSummary();
      }

      const updatedReports = await this.#getReportsToPublish();
      const updatedReportsByPluginId = new Map(updatedReports.map((report) => [report.pluginId, report]));

      for (const report of reportsToPublish) {
        const updatedReport = updatedReportsByPluginId.get(report.pluginId) ?? report;
        const summaryFilepath = updatedReport.files["summary.json"];

        if (!summaryFilepath) {
          continue;
        }

        publishErrorMessage = `Plugin "${report.pluginId}" summary upload has failed, the plugin won't be published`;

        await client.uploadReport({
          reportUuid: this.reportUuid,
          pluginId: updatedReport.pluginId,
          files: { "summary.json": summaryFilepath },
          onProgress: incrementUploadProgress,
        });
      }

      publishErrorMessage = "Report summary upload has failed, the report won't be published";

      const summaryHref = this.#summaryPath
        ? (await client.uploadReport({ reportUuid: this.reportUuid, files: { "index.html": this.#summaryPath } }))
            .indexHref
        : undefined;

      publishErrorMessage = "Report completion has failed, the report won't be published";

      await client.completeReport({
        reportUuid: this.reportUuid,
        historyPoint,
      });

      Object.values(linksByPluginId)
        .filter(Boolean)
        .forEach((href) => this.#publishedRemoteHrefs.add(href));

      if (summaryHref) {
        this.#publishedRemoteHrefs.add(summaryHref);
      }

      this.#published = true;
      logUploadProgress(true);
    } catch (err) {
      if (reportCreated) {
        await this.#cleanupFailedRemoteReport(client);
      }

      if (summariesMutated) {
        this.#summariesByPluginId = summariesSnapshot;
        await this.#writeSummaryFiles();
        await this.#generateRootSummary();
      }

      this.#logPublishError(publishErrorMessage, err);
    } finally {
      endPublishPerfSpan();
    }
  };

  readDirectory = async (resultsDir: string) =>
    measurePerf(PERF_METRIC_NAMES.generateReadResults, async () => {
      if (this.#executionStage !== "running") {
        throw new Error(INIT_REQUIRED_ERROR_MESSAGE);
      }

      const resultsDirPath = resolve(resultsDir);

      if (await readXcResultBundle(this.#store, resultsDirPath)) {
        return;
      }

      try {
        const entries = (await readdir(resultsDirPath, { withFileTypes: true }))
          .filter((dirent) => dirent.isFile())
          .sort((a, b) => a.name.localeCompare(b.name));
        const limit = pLimit(readConcurrency());

        await Promise.all(
          entries.map((dirent) =>
            limit(async () => {
              try {
                const path = await realpath(join(resultsDirPath, dirent.name));

                await this.readResult(new PathResultFile(path, dirent.name));
              } catch (e) {
                console.error(`can't read result file ${dirent.name}`, e);
              }
            }),
          ),
        );
      } catch (e) {
        console.error("can't read directory", e);
      }
    });

  readFile = async (resultsFile: string) =>
    measurePerf(PERF_METRIC_NAMES.generateReadResults, async () => {
      if (this.#executionStage !== "running") {
        throw new Error(INIT_REQUIRED_ERROR_MESSAGE);
      }
      await this.readResult(new PathResultFile(resultsFile));
    });

  readResult = async (data: ResultFile) => {
    if (this.#executionStage !== "running") {
      throw new Error(INIT_REQUIRED_ERROR_MESSAGE);
    }

    for (const reader of this.#readers) {
      try {
        if (reader.matches && !(await reader.matches(data))) {
          continue;
        }

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
    const currentKnownIssues = await this.#store.allKnownIssues();
    const effectiveKnownIssues = new Map<string, KnownTestFailure>();

    [...knownIssues, ...currentKnownIssues].forEach((issue) => {
      effectiveKnownIssues.set(issue.historyId, issue);
    });
    const qualityGateEnvironment =
      environment === undefined
        ? undefined
        : (environmentIdentityById(this.#environments, environment)?.name ??
          environmentIdentityByName(this.#environments, environment)?.name ??
          environment);

    return this.#qualityGate!.validate({
      trs: trs.filter(Boolean),
      knownIssues: [...effectiveKnownIssues.values()],
      state,
      environment: qualityGateEnvironment,
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
    this.#endGeneratePerfSpan = startPerfSpan(PERF_METRIC_NAMES.generateTotal);

    const cwd = resolve(process.cwd());
    const cwdWithSep = cwd.endsWith(sep) ? cwd : `${cwd}${sep}`;

    if (this.#globalAttachments?.length) {
      const matchedFiles = new Set<string>();

      for (const pattern of this.#globalAttachments) {
        const files = await glob(pattern, { cwd, nodir: true, absolute: true });

        files.forEach((filePath) => matchedFiles.add(filePath));
      }

      for (const filePath of matchedFiles) {
        const absoluteFilePath = resolve(filePath);
        const isInsideCwd = absoluteFilePath === cwd || absoluteFilePath.startsWith(cwdWithSep);

        if (!isInsideCwd) {
          continue;
        }

        const originalFileName = basename(absoluteFilePath);

        this.#realtimeChannel.dispatcher.sendGlobalAttachment(
          new PathResultFile(absoluteFilePath, originalFileName),
          originalFileName,
        );
      }
    }

    await this.#eachPlugin(true, async (plugin, context) => {
      await plugin.start?.(context, this.#store, this.#realtimeChannel.subscriber);
    });

    if (this.#realTime) {
      await this.#runRealtimeUpdate();

      this.#realtimeChannel.onResultLikeChanged(() => {
        this.#realtimeUpdateScheduler.request();
      });
    }
  };

  #runRealtimeUpdate = async (): Promise<void> => {
    if (this.#executionStage !== "running") {
      return;
    }

    await this.#eachPlugin(false, async (plugin, context) => {
      await plugin.update?.(context, this.#store);
    });
  };

  dumpState = async (): Promise<void> => {
    const dumpArchive = new ZipWriteStream({
      zlib: { level: 5 },
    });
    const addEntry = promisify(dumpArchive.entry.bind(dumpArchive));
    const dumpPath = `${this.#dump}.zip`;
    const dumpTempPath = `${dumpPath}.${randomUUID()}.tmp`;
    const dumpArchiveWriteStream = createWriteStream(dumpTempPath);
    let dumpArchiveError: unknown;
    let dumpArchiveFinished = false;
    let resolveDumpArchivePromise: (() => void) | undefined;
    const finishDumpArchive = (err?: unknown) => {
      dumpArchiveError ??= err;

      if (!dumpArchiveFinished) {
        dumpArchiveFinished = true;
        resolveDumpArchivePromise?.();
      }
    };
    const dumpArchivePromise = new Promise<void>((res) => {
      resolveDumpArchivePromise = res;

      dumpArchive.on("error", (err) => {
        dumpArchiveWriteStream.destroy();
        finishDumpArchive(err);
      });
      dumpArchiveWriteStream.on("finish", () => finishDumpArchive());
      dumpArchiveWriteStream.on("error", (err) => finishDumpArchive(err));
    });
    const errMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
    const addDumpEntry = async (data: Buffer | ReadStream, entryName: string): Promise<unknown | undefined> => {
      try {
        await addEntry(data, { name: entryName });
        return undefined;
      } catch (err) {
        return err;
      }
    };
    const addRequiredDumpEntry = async (data: Buffer, entryName: string) => {
      const err = await addDumpEntry(data, entryName);

      if (err) {
        throw new Error(`Failed to write dump entry "${entryName}": ${errMessage(err)}`);
      }
    };
    const addJsonDumpEntry = async (entryName: AllureStoreDumpFiles, value: unknown) => {
      await addRequiredDumpEntry(Buffer.from(JSON.stringify(value)), entryName);
    };
    const dumpJsonEntries = ({
      testResults,
      testCases,
      fixtures,
      attachments,
      environments,
      reportVariables,
      checkResults = {},
      globalAttachmentIds = [],
      globalErrors = [],
      indexAttachmentByTestResult = {},
      indexTestResultByHistoryId = {},
      indexTestResultByTestCase = {},
      indexAttachmentByFixture = {},
      indexFixturesByTestResult = {},
      indexKnownByHistoryId = {},
      indexQuarantineByHistoryId = {},
      qualityGateResults = [],
      testResultIdsIngestOrder = [],
    }: AllureStoreDump): [AllureStoreDumpFiles, unknown][] => [
      [AllureStoreDumpFiles.TestResults, testResults],
      [AllureStoreDumpFiles.TestCases, testCases],
      [AllureStoreDumpFiles.Fixtures, fixtures],
      [AllureStoreDumpFiles.Attachments, attachments],
      [AllureStoreDumpFiles.CheckResults, checkResults],
      [AllureStoreDumpFiles.Environments, environments],
      [AllureStoreDumpFiles.ReportVariables, reportVariables],
      [AllureStoreDumpFiles.GlobalAttachments, globalAttachmentIds],
      [AllureStoreDumpFiles.GlobalErrors, globalErrors],
      [AllureStoreDumpFiles.IndexAttachmentsByTestResults, indexAttachmentByTestResult],
      [AllureStoreDumpFiles.IndexTestResultsByHistoryId, indexTestResultByHistoryId],
      [AllureStoreDumpFiles.IndexTestResultsByTestCase, indexTestResultByTestCase],
      [AllureStoreDumpFiles.IndexAttachmentsByFixture, indexAttachmentByFixture],
      [AllureStoreDumpFiles.IndexFixturesByTestResult, indexFixturesByTestResult],
      [AllureStoreDumpFiles.IndexKnownByHistoryId, indexKnownByHistoryId],
      [AllureStoreDumpFiles.IndexQuarantineByHistoryId, indexQuarantineByHistoryId],
      [AllureStoreDumpFiles.QualityGateResults, qualityGateResults],
      [AllureStoreDumpFiles.TestResultIngestOrder, testResultIdsIngestOrder],
    ];
    let dumpError: unknown;

    dumpArchive.pipe(dumpArchiveWriteStream);

    try {
      const allAttachments = await this.#store.allAttachments();

      for (const attachment of allAttachments) {
        const skipAttachment = (message: string) => {
          const originalFileName = attachment.originalFileName ? ` (${attachment.originalFileName})` : "";

          this.#store.markAttachmentMissed(attachment.id);
          console.warn(`Skipping attachment while writing dump: ${attachment.id}${originalFileName}. ${message}`);
        };

        try {
          const content = await this.#store.attachmentContentById(attachment.id);

          if (!content) {
            skipAttachment("attachment content is missing");
            continue;
          }

          if (content instanceof PathResultFile) {
            const stream = createReadStream(content.path);
            const err = await addDumpEntry(stream, attachment.id);

            if (err) {
              await closeReadStream(stream);
              skipAttachment(`failed to add attachment entry: ${errMessage(err)}`);
            }

            continue;
          }

          const data = await content.asBuffer();

          if (data === undefined) {
            skipAttachment("attachment content is missing");
            continue;
          }

          const err = await addDumpEntry(data, attachment.id);

          if (err) {
            skipAttachment(`failed to add attachment entry: ${errMessage(err)}`);
          }
        } catch (err) {
          skipAttachment(errMessage(err));
        }
      }

      for (const [entryName, value] of dumpJsonEntries(this.#store.dumpState())) {
        await addJsonDumpEntry(entryName, value);
      }
    } catch (err) {
      dumpError = err;
    } finally {
      try {
        dumpArchive.finalize();
      } catch (err) {
        dumpError ??= err;
        dumpArchiveWriteStream.destroy();
        finishDumpArchive(err);
      }

      await dumpArchivePromise;
    }

    dumpError ??= dumpArchiveError;

    if (dumpError) {
      await rm(dumpTempPath, { force: true });
      throw dumpError;
    }

    await rename(dumpTempPath, dumpPath);
  };

  restoreState = async (dumps: string[]): Promise<void> => {
    this.#store.resetIngestOrder();
    await this.#restoreStateDumps(dumps);
  };

  #restoreStateDumps = async (dumps: string[]): Promise<void> =>
    measurePerf(PERF_METRIC_NAMES.restoreStateTotal, async () => {
      for (const dump of dumps) {
        await measurePerf(PERF_METRIC_NAMES.restoreStateDump, async () => {
          if (!existsSync(dump)) {
            console.error(`Failed to restore state from "${dump}", continuing without it`);
            console.error("Dump file does not exist");
            return;
          }

          try {
            const dumpArchive = new ZipReadStream.async({
              file: dump,
            });
            let restoreError: unknown;

            try {
              const dumpEntries = await dumpArchive.entries();
              const dumpEntriesList = Object.entries(dumpEntries);
              const requiredEntryData = async (entryName: AllureStoreDumpFiles) => {
                if (!dumpEntries[entryName]) {
                  throw new Error(`Missing required dump entry "${entryName}"`);
                }

                return dumpArchive.entryData(entryName);
              };
              const optionalEntryData = async (entryName: AllureStoreDumpFiles) =>
                dumpEntries[entryName] ? dumpArchive.entryData(entryName) : undefined;

              if (!dumpEntries[AllureStoreDumpFiles.TestResults]) {
                const nestedDumpEntries = dumpEntriesList.filter(
                  ([entryName, entry]) =>
                    !entry.isDirectory &&
                    !entryName.startsWith("__MACOSX/") &&
                    !basename(entryName).startsWith("._") &&
                    entryName.toLowerCase().endsWith(".zip"),
                );

                if (nestedDumpEntries.length > 0) {
                  const nestedDumpsTempDir = await mkdtemp(join(tmpdir(), `${basename(dump, ".zip")}-nested-`));
                  const nestedDumpPaths: string[] = [];

                  this.#dumpTempDirs.push(nestedDumpsTempDir);

                  for (const [entryName] of nestedDumpEntries) {
                    const nestedDumpPath = join(nestedDumpsTempDir, `${nestedDumpPaths.length}-${basename(entryName)}`);

                    await writeFile(nestedDumpPath, await dumpArchive.entryData(entryName));
                    nestedDumpPaths.push(nestedDumpPath);
                  }

                  await this.#restoreStateDumps(nestedDumpPaths);
                  return;
                }
              }

              const testResultsEntry = await requiredEntryData(AllureStoreDumpFiles.TestResults);
              const testCasesEntry = await requiredEntryData(AllureStoreDumpFiles.TestCases);
              const fixturesEntry = await requiredEntryData(AllureStoreDumpFiles.Fixtures);
              const attachmentsEntry = await requiredEntryData(AllureStoreDumpFiles.Attachments);
              const checkResultsEntry = await optionalEntryData(AllureStoreDumpFiles.CheckResults);
              const environmentsEntry = await requiredEntryData(AllureStoreDumpFiles.Environments);
              const reportVariablesEntry = await requiredEntryData(AllureStoreDumpFiles.ReportVariables);
              const globalAttachmentsEntry = await requiredEntryData(AllureStoreDumpFiles.GlobalAttachments);
              const globalErrorsEntry = await requiredEntryData(AllureStoreDumpFiles.GlobalErrors);
              const indexAttachmentsEntry = await requiredEntryData(AllureStoreDumpFiles.IndexAttachmentsByTestResults);
              const indexTestResultsByHistoryId = await requiredEntryData(
                AllureStoreDumpFiles.IndexTestResultsByHistoryId,
              );
              const indexTestResultsByTestCaseEntry = await requiredEntryData(
                AllureStoreDumpFiles.IndexTestResultsByTestCase,
              );
              const indexAttachmentsByFixtureEntry = await requiredEntryData(
                AllureStoreDumpFiles.IndexAttachmentsByFixture,
              );
              const indexFixturesByTestResultEntry = await requiredEntryData(
                AllureStoreDumpFiles.IndexFixturesByTestResult,
              );
              const indexKnownByHistoryIdEntry = await requiredEntryData(AllureStoreDumpFiles.IndexKnownByHistoryId);
              const indexQuarantineByHistoryIdEntry = await optionalEntryData(
                AllureStoreDumpFiles.IndexQuarantineByHistoryId,
              );
              const qualityGateResultsEntry = await requiredEntryData(AllureStoreDumpFiles.QualityGateResults);
              const testResultIngestOrderEntry = await optionalEntryData(AllureStoreDumpFiles.TestResultIngestOrder);
              const attachmentsLinks = JSON.parse(attachmentsEntry.toString("utf8")) as AllureStoreDump["attachments"];

              const attachmentsEntries = dumpEntriesList.reduce((acc, [entryName, entry]) => {
                switch (entryName) {
                  case AllureStoreDumpFiles.Attachments:
                  case AllureStoreDumpFiles.CheckResults:
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
                  case AllureStoreDumpFiles.IndexAttachmentsByFixture:
                  case AllureStoreDumpFiles.IndexFixturesByTestResult:
                  case AllureStoreDumpFiles.IndexKnownByHistoryId:
                  case AllureStoreDumpFiles.IndexQuarantineByHistoryId:
                  case AllureStoreDumpFiles.QualityGateResults:
                  case AllureStoreDumpFiles.TestResultIngestOrder:
                    return acc;
                  default:
                    if (entry.isDirectory || !attachmentsLinks[entryName] || attachmentsLinks[entryName].missed) {
                      return acc;
                    }

                    return Object.assign(acc, {
                      [entryName]: entry,
                    });
                }
              }, {});
              const dumpState: AllureStoreDump = {
                testResults: JSON.parse(testResultsEntry.toString("utf8")),
                testCases: JSON.parse(testCasesEntry.toString("utf8")),
                fixtures: JSON.parse(fixturesEntry.toString("utf8")),
                attachments: attachmentsLinks,
                checkResults: checkResultsEntry ? JSON.parse(checkResultsEntry.toString("utf8")) : [],
                environments: JSON.parse(environmentsEntry.toString("utf8")),
                reportVariables: JSON.parse(reportVariablesEntry.toString("utf8")),
                globalAttachmentIds: JSON.parse(globalAttachmentsEntry.toString("utf8")),
                globalErrors: JSON.parse(globalErrorsEntry.toString("utf8")),
                indexAttachmentByTestResult: JSON.parse(indexAttachmentsEntry.toString("utf8")),
                indexTestResultByHistoryId: JSON.parse(indexTestResultsByHistoryId.toString("utf8")),
                indexTestResultByTestCase: JSON.parse(indexTestResultsByTestCaseEntry.toString("utf8")),
                indexAttachmentByFixture: JSON.parse(indexAttachmentsByFixtureEntry.toString("utf8")),
                indexFixturesByTestResult: JSON.parse(indexFixturesByTestResultEntry.toString("utf8")),
                indexKnownByHistoryId: JSON.parse(indexKnownByHistoryIdEntry.toString("utf8")),
                indexQuarantineByHistoryId: indexQuarantineByHistoryIdEntry
                  ? JSON.parse(indexQuarantineByHistoryIdEntry.toString("utf8"))
                  : {},
                qualityGateResults: JSON.parse(qualityGateResultsEntry.toString("utf8")),
                testResultIdsIngestOrder: testResultIngestOrderEntry
                  ? JSON.parse(testResultIngestOrderEntry.toString("utf8"))
                  : [],
              };
              const dumpTempDir = await mkdtemp(join(tmpdir(), basename(dump, ".zip")));
              const resultsAttachments: Record<string, ResultFile> = {};

              this.#dumpTempDirs.push(dumpTempDir);

              await measurePerf(PERF_METRIC_NAMES.restoreStateAttachments, async () => {
                try {
                  for (const [attachmentId] of Object.entries(attachmentsEntries)) {
                    const attachmentContentEntry = await dumpArchive.entryData(attachmentId);
                    const attachmentFilePath = resolveDumpAttachmentPath(dumpTempDir, attachmentId);

                    await writeFile(attachmentFilePath, attachmentContentEntry);

                    resultsAttachments[attachmentId] = new PathResultFile(attachmentFilePath, attachmentId);
                  }
                } catch (err) {
                  if (err instanceof UnsafeDumpPathError) {
                    console.error(
                      `Cannot restore dump from "${dump}": the archive lists attachment paths that would write outside the extract directory (unsafe zip paths such as "../" or absolute names).`,
                    );
                    console.error(err.message);
                    console.error(
                      "Only use dump archives produced by this tool; do not load untrusted or third-party --dump zip files.",
                    );
                    throw err;
                  }
                  console.error(`Can't restore attachment contents from "${dump}", continuing without them`);
                  console.error(errorDetails(err));
                }
              });

              await measurePerf(PERF_METRIC_NAMES.restoreStateStoreRestore, async () =>
                this.#store.restoreState(dumpState, resultsAttachments),
              );

              console.info(`Successfully restored state from "${dump}"`);
            } catch (err) {
              restoreError = err;
              throw err;
            } finally {
              try {
                await dumpArchive.close();
              } catch (err) {
                if (!restoreError) {
                  console.error(`Failed to close dump archive "${dump}"`);
                  console.error(errorDetails(err));
                }
              }
            }
          } catch (err) {
            console.error(`Failed to restore state from "${dump}", continuing without it`);
            console.error(errorDetails(err));
          }
        });
      }
    });

  #getReportsToPublish = async (): Promise<PluginReportFile[]> => {
    const reports: PluginReportFile[] = [];

    for (const { enabled, id, options } of this.#plugins) {
      if (!enabled) {
        continue;
      }

      const files = (await this.#state?.[id]?.get<Record<string, string>>("files")) ?? {};

      reports.push({
        pluginId: id,
        publish: !!options?.publish,
        files,
      });
    }

    return reports;
  };

  #cleanupFailedRemoteReport = async (client: AllureServiceApiClient): Promise<void> => {
    try {
      await client.deleteReport({
        reportUuid: this.reportUuid,
      });
    } catch (cleanupError) {
      console.error("Failed to clean up failed report upload");
      console.error(errorDetails(cleanupError));
    }
  };

  #logPublishError = (message: string, err: unknown): void => {
    console.error(message);

    if (err instanceof KnownError) {
      console.error(err.message);
    } else {
      console.error(errorDetails(err));
    }
  };

  #applyPublishLinksToSummaries = (linksByPluginId: Record<string, string>): Set<string> => {
    const changedPluginIds = new Set<string>();

    if (this.#summariesByPluginId.size === 0) {
      return changedPluginIds;
    }

    for (const [pluginId, remoteHref] of Object.entries(linksByPluginId)) {
      const summary = this.#summariesByPluginId.get(pluginId);

      if (summary && remoteHref) {
        summary.remoteHref = remoteHref;
        changedPluginIds.add(pluginId);
      }
    }

    return changedPluginIds;
  };

  #cloneSummariesByPluginId = (): Map<string, PluginSummary> =>
    new Map([...this.#summariesByPluginId].map(([pluginId, summary]) => [pluginId, clonePluginSummary(summary)]));

  #writeSummaryFiles = async (pluginIds?: Iterable<string>): Promise<void> => {
    if (this.#summariesByPluginId.size === 0) {
      return;
    }

    const pluginIdsSet = pluginIds ? new Set(pluginIds) : undefined;

    await this.#eachPlugin(false, async (_plugin, context) => {
      if (pluginIdsSet && !pluginIdsSet.has(context.id)) {
        return;
      }

      const summary = this.#summariesByPluginId.get(context.id);

      if (!summary) {
        return;
      }

      // expose summary.json file to the FS to make possible to use it in the integrations
      await context.reportFiles.addFile("summary.json", Buffer.from(JSON.stringify(summary)));
    });
  };

  #generateRootSummary = async (): Promise<void> => {
    const summaries = [...this.#summariesByPluginId.values()].map(clonePluginSummary);

    if (summaries.length > 1) {
      this.#summaryPath = await measurePerf(PERF_METRIC_NAMES.summaryGenerate, async () =>
        generateSummary(this.#output, summaries),
      );
    } else {
      this.#summaryPath = undefined;
    }
  };

  done = async (): Promise<void> => {
    const summaries: PluginSummary[] = [];

    if (this.#executionStage !== "running") {
      throw new Error(INIT_REQUIRED_ERROR_MESSAGE);
    }

    try {
      const testResults = await this.#store.allTestResults();
      const testCases = await this.#store.allTestCases();
      this.#historyDataPoint = createHistory(this.reportUuid, this.reportName, testCases, testResults, this.reportUrl);

      this.#realtimeChannel.close();
      try {
        await this.#realtimeUpdateScheduler.close();
      } catch (e) {
        console.error("realtime update failed during shutdown", e);
      }
      // closing it after realtime update settles, to prevent future reads
      this.#executionStage = "done";

      // just dump state when dump is set and generate nothing
      if (this.#dump) {
        await this.dumpState();
        return;
      }

      // isolate logs of different reports dumps: done and summary
      await measurePerf(PERF_METRIC_NAMES.generatePluginsDone, async () => {
        await this.#eachPlugin(false, async (plugin, context) => {
          await measurePerf(`${PERF_METRIC_PREFIXES.generatePluginDone}${context.id}`, async () => {
            await plugin.done?.(context, this.#store);
          });
        });
      });
      this.#finishGeneratePerfSpan();
      await this.#eachPlugin(false, async (plugin, context) => {
        const summary = await plugin?.info?.(context, this.#store);

        if (!summary) {
          return;
        }

        summary.pluginId = context.id;
        summary.pullRequestHref = this.#ci?.pullRequestUrl;
        summary.jobHref = this.#ci?.jobRunUrl;

        summaries.push({
          ...summary,
          href: `${context.id}/`,
        });
      });

      this.#summariesByPluginId = new Map(
        summaries
          .filter((summary): summary is PluginSummary & { pluginId: string } => !!summary.pluginId)
          .map((summary) => [summary.pluginId, summary]),
      );

      await this.#publish();

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

      if (this.#history && this.#appendHistory) {
        try {
          await this.#store.appendHistory(this.#historyDataPoint!);
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

      if (this.#quarantinePath) {
        try {
          await writeQuarantine(this.#store, this.#quarantinePath);
        } catch (err) {
          console.error("Failed to write quarantine issues", errorDetails(err));
        }
      }

      if (this.#publishedRemoteHrefs.size > 0) {
        console.info("Next reports have been published:");

        this.#publishedRemoteHrefs.forEach((href) => {
          console.info(`- ${href}`);
        });
      }

      if (!this.#qualityGate) {
        return;
      }

      const qualityGateResults = await this.#store.qualityGateResultsByEnv();

      await writeFile(join(this.#output, "quality-gate.json"), JSON.stringify(qualityGateResults));
    } finally {
      await this.#finishPerfMetrics();
    }
  };

  #finishGeneratePerfSpan = () => {
    this.#endGeneratePerfSpan?.();
    this.#endGeneratePerfSpan = undefined;
  };

  #finishPerfMetrics = async () => {
    this.#finishGeneratePerfSpan();

    try {
      await writePerfMetrics(this.#output);
    } catch (err) {
      console.error("Failed to write Allure performance metrics", err);
    }
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
        reportName: this.reportName,
        hideLabels: this.#hideLabels,
        state: pluginState,
        reportFiles: pluginFiles,
        reportUrl: this.reportUrl,
        realTime: !!this.#realTime,
        output: this.#output,
        ci: this.#ci,
        categories: this.#categories,
        history: this.#history,
      };

      try {
        await consumer.call(this, plugin, pluginContext);

        this.reportUrl = pluginContext.reportUrl ?? this.reportUrl;

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
