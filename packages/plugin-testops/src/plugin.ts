import { env } from "node:process";

import { applyAllureCiEnv, detect, isLocalCiDescriptor } from "@allurereport/ci";
import { createProgressLogger } from "@allurereport/cli-commons";
import type {
  CiDescriptor,
  EnvironmentIdentity,
  GlobalAttachmentLink,
  TestError,
  TestStatus,
} from "@allurereport/core-api";
import { getWorstStatus } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginConstructorContext,
  type PluginContext,
  createPluginSummary,
} from "@allurereport/plugin-api";
import { uniqBy, stubTrue } from "lodash-es";
import { bold } from "yoctocolors";

import { TestOpsClient } from "./client.js";
import { isClosedLaunchError } from "./errors.js";
import { LaunchGitFlow, resolveGitFlowOptions } from "./gitFlow/index.js";
import { Logger } from "./logger.js";
import type { TestOpsPluginTestResult, TestOpsPluginOptions } from "./model.js";
import { UploadQueue } from "./uploadQueue.js";
import { uploadFilenameForLink } from "./utils/attachments.js";
import { applyCiOverrides } from "./utils/ciOverrides.js";
import { enrichWithCategories, syncLaunchCategories } from "./utils/launchCategories.js";
import { resolvePluginOptions, toPositiveInteger } from "./utils/options.js";
import { attachmentsResolverFactory, fixturesResolverFactory } from "./utils/resolvers.js";
import { validateExecutableName } from "./utils/validation.js";

const LAUNCH_PROGRESS_POLL_DELAY_MS = 500;
const LAUNCH_PROGRESS_ATTEMPTS_LIMIT = 10;

const resolveJobRunIdFromEnv = (): number | undefined => toPositiveInteger(env.ALLURE_JOB_RUN_ID);

export class TestOpsPlugin implements Plugin {
  #logger = new Logger("TestOpsPlugin");
  #ci: CiDescriptor;
  #client!: TestOpsClient;
  #launchName: string = "";
  #launchTags: string[] = [];
  #uploadedTestResultsIds: Set<string> = new Set();
  #uploadedGlobalAttachmentIds: Set<string> = new Set();
  #uploadedGlobalErrors: Set<TestError> = new Set();
  #autocloseLaunch: boolean = false;
  #launchStarted: boolean = false;
  #reopenClosedLaunch: boolean = false;
  #skippedUploadCycle: boolean = false;
  #launchId?: number;
  #gitFlow!: LaunchGitFlow;
  #enabledByConfig: boolean = false;
  #uploadQueue = new UploadQueue();

  constructor(
    readonly options: TestOpsPluginOptions,
    context: PluginConstructorContext = {},
  ) {
    applyAllureCiEnv();
    this.#ci = applyCiOverrides(detect());
    this.#enabledByConfig = context.enabled === true;

    if (context.enabled === false) {
      return;
    }

    if (isLocalCiDescriptor(this.#ci) && !this.isManuallyEnabled) {
      this.#logger.info(
        `plugin is disabled - no CI environment detected. To enable, set ${bold("ALLURE_TESTOPS_ENABLED")}=true or ${bold("CI")}=true.`,
      );
      return;
    }

    const {
      accessToken,
      endpoint,
      projectId,
      launchName,
      launchTags,
      autocloseLaunch = true,
      uploadRateLimit,
      reopenClosedLaunch = false,
      launchId,
    } = resolvePluginOptions(options);

    // don't initialize the client when some options are missing
    // we can' throw an error here because it would break the report execution flow
    if ([accessToken, endpoint, projectId].every(Boolean)) {
      this.#client = new TestOpsClient({
        baseUrl: endpoint,
        accessToken,
        projectId,
        uploadRateLimit,
      });
      this.#launchName = launchName;
      this.#launchTags = launchTags;
    }

    this.#autocloseLaunch = autocloseLaunch;
    this.#reopenClosedLaunch = reopenClosedLaunch;
    this.#launchId = launchId;
    const gitFlowOptions = resolveGitFlowOptions(options);

    this.#gitFlow = new LaunchGitFlow({
      ci: this.#ci,
      gitFlow: gitFlowOptions.gitFlow,
      ancestorLimit: gitFlowOptions.ancestorLimit,
      logger: this.#logger,
    });

    if (!accessToken) {
      this.#logger.warn(
        `Allure TestOps ${bold("access token")} is missing. Please provide a valid access token in the plugin options.`,
      );
    }

    if (!endpoint) {
      this.#logger.warn(
        `Allure TestOps ${bold("endpoint")} is missing. Please provide a valid endpoint in the plugin options.`,
      );
    }

    if (!projectId) {
      this.#logger.warn(
        `Allure TestOps ${bold("project ID")} is missing. Please provide a valid project ID in the plugin options.`,
      );
    }
  }

  get isOverridenByEnv(): boolean {
    const isEnabled = (value: string | undefined) => {
      if (!value) {
        return false;
      }

      return ["true", "1"].includes(value);
    };

    return isEnabled(env.ALLURE_TESTOPS_ENABLED) || isEnabled(env.CI) || resolveJobRunIdFromEnv() !== undefined;
  }

  get isManuallyEnabled(): boolean {
    return this.#enabledByConfig || this.isOverridenByEnv;
  }

  get enabled(): boolean {
    if (!(this.#client instanceof TestOpsClient)) {
      return false;
    }

    if (this.isManuallyEnabled) {
      return true;
    }

    if (!this.#ci || this.#ci.type === "local") {
      return false;
    }

    return true;
  }

  async #reopenLaunchIfClosed(error: unknown): Promise<void> {
    if (!this.#reopenClosedLaunch || !isClosedLaunchError(error)) {
      return;
    }

    const launchId = this.#client.launchId;

    if (launchId === undefined) {
      return;
    }

    try {
      this.#logger.warn(`Launch ${launchId} was closed - reopening before retrying the upload…`);
      await this.#client.reopenLaunch(launchId);
    } catch (reopenError) {
      this.#logger.debug(`Failed to reopen launch ${launchId}: ${reopenError}`);
    }
  }

  #logDeferredUpload(label: string, error?: unknown) {
    this.#logger.warn(
      error
        ? `TestOps upload is unavailable; ${label} will be retried during finalization. Reason: ${error}`
        : `TestOps upload is suspended; ${label} will be retried during finalization.`,
    );
  }

  #retryHooks(label: string) {
    return {
      onRetry: async (error: unknown, attempt: number) => {
        this.#logger.debug(`Retrying ${label} upload (attempt ${attempt}): ${error}`);
        await this.#reopenLaunchIfClosed(error);
      },
      onDeferred: (error?: unknown) => this.#logDeferredUpload(label, error),
    };
  }

  #logUploadFailure(label: string, error: unknown) {
    if (this.#client.isTestOpsClientError(error)) {
      this.#logger.error(`Failed to upload ${label}: ${error.response.data.message}`);
      this.#logger.debug(error.response?.data);
    } else if (error instanceof Error) {
      this.#logger.error(`Failed to upload ${label}: ${error.message}`);
    } else {
      this.#logger.error(`Failed to upload ${label}`);
    }
  }

  async #uploadQualityGateResults(store: AllureStore) {
    const results = await store.qualityGateResults();
    const uniqueResults = uniqBy(
      // Leave only failed ones
      results.filter(({ success }) => !success),
      // TestOps is against duplicates, uniqueness is by rule and environment and launch id
      ({ rule, environment }) => `${rule}-${environment}`,
    );

    if (uniqueResults.length === 0) {
      this.#logger.verbose("No quality gate results to upload");
      return;
    }

    const progressLogger = createProgressLogger({
      total: 1,
      message: "Uploading quality gate results",
      unitLabel: "request uploaded",
      prefix: "[TestOpsPlugin]",
    });
    let completed = false;

    try {
      progressLogger.log(true);

      const result = await this.#uploadQueue.run(
        "quality-gate",
        () =>
          this.#client.uploadQualityGateResults(uniqueResults, (percent) => {
            if (!completed && percent >= 100) {
              completed = true;
              progressLogger.increment();
            }
          }),
        this.#retryHooks("quality gate results"),
      );

      if (result.deferred) {
        return;
      }

      if (!completed) {
        progressLogger.increment();
      }

      progressLogger.log(true);
    } catch (error) {
      this.#logUploadFailure("quality gate results", error);
    } finally {
      progressLogger.cancel?.();
    }
  }

  async #uploadGlobalErrors(results: TestError[]) {
    if (results.length === 0) {
      this.#logger.verbose("No new global errors to upload");
      return;
    }

    const progressLogger = createProgressLogger({
      total: 1,
      message: "Uploading global errors",
      unitLabel: "request uploaded",
      prefix: "[TestOpsPlugin]",
    });
    let completed = false;

    try {
      progressLogger.log(true);
      const result = await this.#uploadQueue.run(
        "global-errors",
        () =>
          this.#client.uploadGlobalErrors(results, (percent) => {
            if (!completed && percent >= 100) {
              completed = true;
              progressLogger.increment();
            }
          }),
        this.#retryHooks("global errors"),
      );

      if (result.deferred) {
        return;
      }

      if (!completed) {
        progressLogger.increment();
      }

      results.forEach((error) => {
        this.#uploadedGlobalErrors.add(error);
      });

      progressLogger.log(true);
    } catch (error) {
      this.#logUploadFailure("global errors", error);
    } finally {
      progressLogger.cancel?.();
    }
  }

  async #uploadGlobalAttachments(store: AllureStore, attachments: GlobalAttachmentLink[]) {
    if (attachments.length === 0) {
      this.#logger.debug("No new global attachments to upload");
      return;
    }

    const progressLogger = createProgressLogger({
      total: 1,
      message: "Uploading global attachments",
      unitLabel: "request uploaded",
      prefix: "[TestOpsPlugin]",
    });
    let completed = false;

    try {
      progressLogger.log(true);
      const result = await this.#uploadQueue.run(
        "global-attachments",
        () =>
          this.#client.uploadGlobalAttachments({
            attachments,
            attachmentsResolver: async (attachmentLink) => {
              const content = await store.attachmentContentById(attachmentLink.id);
              const body = await content?.readContent(async (stream) => stream);
              const filename = uploadFilenameForLink(attachmentLink);

              if (filename === undefined || body === undefined) {
                return undefined;
              }

              return {
                originalFileName: filename,
                contentType: attachmentLink.contentType ?? "application/octet-stream",
                content: body,
                contentLength: content?.getContentLength(),
              };
            },
            onProgress: (percent) => {
              if (!completed && percent >= 100) {
                completed = true;
                progressLogger.increment();
              }
            },
          }),
        this.#retryHooks("global attachments"),
      );

      if (result.deferred) {
        return;
      }

      if (!completed) {
        progressLogger.increment();
      }

      attachments.forEach((attachment) => {
        this.#uploadedGlobalAttachmentIds.add(attachment.id);
      });

      progressLogger.log(true);
    } catch (error) {
      this.#logUploadFailure("global attachments", error);
    } finally {
      progressLogger.cancel?.();
    }
  }

  async #uploadTestResults(
    store: AllureStore,
    trsToUpload: TestOpsPluginTestResult[],
    environments: EnvironmentIdentity[],
    options?: {
      silent?: boolean;
    },
  ) {
    const totalCount = trsToUpload.length;

    this.#logger.verbose(
      `Preparing to upload ${bold(totalCount.toString())} ${totalCount > 1 ? "test results" : "test result"}`,
    );

    const progressLogger = createProgressLogger({
      total: totalCount,
      message: "Uploading test results",
      unitLabel: totalCount === 1 ? "test result uploaded" : "test results uploaded",
      prefix: "[TestOpsPlugin]",
      silent: !!options?.silent,
    });

    try {
      progressLogger.log(true);

      const { onRetry, onDeferred } = this.#retryHooks("test results");

      const result = await this.#uploadQueue.run(
        "test-results",
        () =>
          this.#client.uploadTestResults({
            attachmentsResolver: attachmentsResolverFactory(store),
            fixturesResolver: fixturesResolverFactory(store),
            environments,
            trs: trsToUpload.filter((tr) => !this.#uploadedTestResultsIds.has(tr.id)),
            onProgress: () => progressLogger.increment(),
            onRetry,
            onChunkUploaded: (uploadedChunkTrs) => {
              uploadedChunkTrs.forEach((tr) => this.#uploadedTestResultsIds.add(tr.id));
            },
          }),
        { onRetry, onDeferred },
      );

      if (result.deferred) {
        return;
      }

      const uploadedTrs = result.value;

      progressLogger.log(true);

      uploadedTrs.forEach((tr) => {
        this.#uploadedTestResultsIds.add(tr.id);
      });

      const uploadedCount = uploadedTrs.length;

      if (uploadedCount === 0) {
        this.#logger.verbose("No test results were uploaded");
        return;
      }

      this.#logger.info(`Uploaded ${uploadedCount} ${uploadedCount > 1 ? "test results" : "test result"}`);
    } catch (error) {
      this.#logUploadFailure("test results", error);
    } finally {
      progressLogger.cancel?.();
    }
  }

  async #upload(
    store: AllureStore,
    options = {} as {
      context?: PluginContext;
      stage: "start" | "update" | "done";
    },
  ) {
    const { context, stage } = options;
    const trsToUpload = await this.#trsToUpload(store);
    const shouldUploadGlobalArtifacts = stage === "done" || !context?.realTime;
    let globalErrors: TestError[] = [];
    let globalAttachments: GlobalAttachmentLink[] = [];

    if (shouldUploadGlobalArtifacts) {
      const [allGlobalErrors, allGlobalAttachments] = await Promise.all([
        store.allGlobalErrors(),
        store.allGlobalAttachments(),
      ]);
      globalErrors = allGlobalErrors.filter((error) => !this.#uploadedGlobalErrors.has(error));
      globalAttachments = allGlobalAttachments.filter(
        (attachment) => !this.#uploadedGlobalAttachmentIds.has(attachment.id),
      );
    }

    if (trsToUpload.length === 0) {
      if (stage == "update") {
        this.#logger.verbose("No new test results to upload");
      }

      if (stage === "done") {
        this.#logger.verbose("No test results to upload");
      }

      if (globalErrors.length === 0 && globalAttachments.length === 0) {
        return;
      }
    }

    if (stage === "update" && trsToUpload.length > 0) {
      this.#logger.verbose(
        `Found ${bold(trsToUpload.length.toString())} new test ${trsToUpload.length > 1 ? "results" : "result"}, uploading…`,
      );
    }

    try {
      await this.#client.createSession(env, this.#reopenClosedLaunch);
    } catch (error) {
      this.#skippedUploadCycle = true;

      if (this.#client.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to create TestOps session: ${error.response.data.message}`);
        this.#logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to create TestOps session: ${error.message}`);
      } else {
        this.#logger.error("Failed to create TestOps session");
      }

      return;
    }

    this.#skippedUploadCycle = false;

    await this.#uploadGlobalAttachments(store, globalAttachments);
    await this.#uploadGlobalErrors(globalErrors);

    if (trsToUpload.length === 0) {
      return;
    }

    await this.#uploadQualityGateResults(store);

    const environments = await store.allEnvironmentIdentities();
    const contextCategories = context?.categories ?? [];
    const trsEnrichedWithCategories = await enrichWithCategories(store, trsToUpload, contextCategories);

    await syncLaunchCategories(this.#client, trsEnrichedWithCategories, contextCategories);
    await this.#uploadTestResults(store, trsEnrichedWithCategories, environments, {
      silent: !!context?.realTime,
    });
  }

  async #trsToUpload(store: AllureStore) {
    const filter = this.options.filter ?? stubTrue;
    const filteredTrs = await store.allTestResults({
      filter: (tr) => {
        const uploaded = this.#uploadedTestResultsIds.has(tr.id);

        if (uploaded) {
          return false;
        }

        return validateExecutableName(tr.name) && filter(tr);
      },
      includeRetries: false,
    });

    return filteredTrs;
  }

  /**
   * Creates the launch and starts the CI upload session. Unlike the per-content upload
   * methods, a failure here means there's no launch to upload anything to at all, so it's
   * caught and reported rather than left to crash the report generation for every plugin.
   */
  async #startUpload(): Promise<boolean> {
    const jobRunId = resolveJobRunIdFromEnv();

    try {
      if (!jobRunId) {
        if (this.#launchId !== undefined) {
          this.#client.attachToLaunch(this.#launchId);
        } else {
          const launchGitContext = this.#gitFlow.resolve();

          await this.#client.createLaunch(this.#launchName, this.#launchTags, launchGitContext);
        }
      }

      await this.#client.startUpload(this.#ci!, jobRunId);
      this.#launchStarted = true;
    } catch (error) {
      if (this.#client.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to create TestOps launch: ${error.response.data.message}`);
        this.#logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to create TestOps launch: ${error.message}`);
      } else {
        this.#logger.error("Failed to create TestOps launch");
      }
    }

    return this.#launchStarted;
  }

  async #stopUpload(status: TestStatus) {
    await this.#client.stopUpload(this.#ci!, status);
  }

  async start(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return;
    }

    if (context.realTime) {
      this.#logger.setLogLevel("info");
    }

    this.#logger.verbose("Starting upload…");

    if (!(await this.#startUpload())) {
      return;
    }

    await this.#upload(store, { context, stage: "start" });

    this.#logger.info(`Allure TestOps Launch: ${this.#client.launchUrl}`);
  }

  async update(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return;
    }

    if (!this.#launchStarted) {
      this.#logger.verbose("Skipping update: the TestOps launch was never started");
      return;
    }

    this.#logger.verbose("Updating (uploading new results)…");

    await this.#upload(store, { context, stage: "update" });
  }

  async done(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return;
    }

    if (!this.#launchStarted) {
      this.#logger.verbose("Skipping finalization: the TestOps launch was never started");
      return;
    }

    const allTrs = await store.allTestResults({
      filter: this.options.filter,
      includeRetries: false,
    });

    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));

    this.#logger.verbose("Finalizing upload…");

    await this.#upload(store, { context, stage: "done" });

    const stillPending = await this.#uploadQueue.flush({
      onRetry: async (error, attempt) => {
        this.#logger.debug(`Retrying deferred TestOps upload at finalization (attempt ${attempt}): ${error}`);
        await this.#reopenLaunchIfClosed(error);
      },
    });

    if (stillPending.length > 0) {
      this.#logger.error(
        `${stillPending.length} TestOps upload(s) could not be completed after retrying at finalization: ${stillPending.join(", ")}`,
      );
    }

    try {
      await this.#stopUpload(worstStatus || "unknown");
    } catch (error) {
      if (this.#client.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to stop TestOps upload: ${error.response.data.message}`);
        this.#logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to stop TestOps upload: ${error.message}`);
      } else {
        this.#logger.error("Failed to stop TestOps upload");
      }
    }

    const launchId = this.#client.launchId;

    if (typeof launchId !== "number") {
      return;
    }

    if (!this.#autocloseLaunch) {
      this.#logger.info(`Upload finished. Allure TestOps Launch: ${this.#client.launchUrl}`);
      return;
    }

    if (stillPending.length > 0 || this.#skippedUploadCycle) {
      this.#logger.warn(
        `Not closing launch ${launchId}: some uploads never made it to TestOps, closing now would report an incomplete launch as finished.`,
      );
      return;
    }

    let launchIsReady = false;

    for (let attempt = 0; attempt < LAUNCH_PROGRESS_ATTEMPTS_LIMIT; attempt += 1) {
      launchIsReady = await this.#client.checkLaunchProgress();

      if (launchIsReady) {
        break;
      }

      if (attempt < LAUNCH_PROGRESS_ATTEMPTS_LIMIT - 1) {
        await new Promise((resolve) => setTimeout(resolve, LAUNCH_PROGRESS_POLL_DELAY_MS));
      }
    }

    if (launchIsReady) {
      try {
        await this.#client.closeLaunch(launchId);
      } catch (err) {
        if (err instanceof Error) {
          this.#logger.debug(`Failed to close launch: ${err.message}`);
        } else {
          this.#logger.debug("Failed to close launch");
        }
      }
    }

    this.#logger.info(`Upload finished. Allure TestOps Launch: ${this.#client.launchUrl}`);
  }

  async info(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return undefined;
    }

    if (!this.#client.launchUrl) {
      return undefined;
    }

    const summary = await createPluginSummary({
      name: this.#launchName,
      plugin: "TestOps",
      meta: {
        reportId: context.reportUuid,
      },
      filter: this.options.filter,
      history: context.history,
      ci: context.ci,
      store,
    });

    summary.remoteHref = this.#client.launchUrl;

    return summary;
  }
}
