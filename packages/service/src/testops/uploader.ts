import { createProgressLogger, type Logger } from "@allurereport/cli-commons";
import type {
  AllureQualityGateResult,
  AttachmentLink,
  CiDescriptor,
  EnvironmentIdentity,
  GlobalAttachmentLink,
  TestError,
  TestStatus,
} from "@allurereport/core-api";
import { uniqBy } from "lodash-es";
import { bold } from "yoctocolors";

import type { TestOpsClient } from "./client.js";
import { isClosedLaunchError } from "./errors.js";
import type { LaunchGitContextDto } from "./gitContext.js";
import type {
  AttachmentForUpload,
  AttachmentsResolver,
  FixtureResolver,
  TestOpsSession,
  TestOpsUploadTestResult,
} from "./model.js";
import { UploadQueue } from "./uploadQueue.js";

const LAUNCH_PROGRESS_POLL_DELAY_MS = 500;
const LAUNCH_PROGRESS_ATTEMPTS_LIMIT = 10;

/** Manages one TestOps launch with a dedicated client. */
export class TestOpsUploader {
  static readonly #usedClients = new WeakSet<TestOpsClient>();

  #uploadedTestResultsIds = new Set<string>();
  #uploadedGlobalAttachmentIds = new Set<string>();
  #uploadedGlobalErrors = new Set<TestError>();
  #skippedUploadCycle = false;
  #environmentSessions = new Map<string, TestOpsSession>();
  #uploadQueue = new UploadQueue();

  constructor(
    private readonly client: TestOpsClient,
    private readonly logger: Pick<Logger, "debug" | "error" | "info" | "verbose" | "warn">,
    private readonly reopenClosedLaunch: boolean,
  ) {}

  hasUploadedTestResult(id: string): boolean {
    return this.#uploadedTestResultsIds.has(id);
  }

  pendingGlobalAttachments(attachments: GlobalAttachmentLink[]): GlobalAttachmentLink[] {
    return attachments.filter((attachment) => !this.#uploadedGlobalAttachmentIds.has(attachment.id));
  }

  pendingGlobalErrors(errors: TestError[]): TestError[] {
    return errors.filter((error) => !this.#uploadedGlobalErrors.has(error));
  }

  /**
   * Creates or attaches to the launch and starts the CI upload session. Operational failures are logged and return
   * false. A start attempt reserves the client even if CI registration fails after the launch has been created.
   */
  async startUpload(
    ci: CiDescriptor,
    options: {
      jobRunId?: number;
      launchId?: number;
      launchName: string;
      launchTags: string[];
      gitContext?: () => LaunchGitContextDto | undefined;
    },
  ): Promise<boolean> {
    if (TestOpsUploader.#usedClients.has(this.client)) {
      throw new Error("Use a new TestOpsUploader and TestOpsClient for each launch");
    }

    TestOpsUploader.#usedClients.add(this.client);

    const { jobRunId, launchId, launchName, launchTags, gitContext } = options;

    try {
      if (!jobRunId) {
        if (launchId !== undefined) {
          this.client.attachToLaunch(launchId);
        } else {
          const launchGitContext = gitContext?.();

          await this.client.createLaunch(launchName, launchTags, launchGitContext);
        }
      }

      await this.client.startUpload(ci, jobRunId);
      return true;
    } catch (error) {
      if (this.client.isTestOpsClientError(error)) {
        this.logger.error(`Failed to create TestOps launch: ${error.response.data.message}`);
        this.logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.logger.error(`Failed to create TestOps launch: ${error.message}`);
      } else {
        this.logger.error("Failed to create TestOps launch");
      }
    }

    return false;
  }

  async prepareUploadSession(
    environment: Record<string, unknown>,
    needsBaseSession: boolean,
  ): Promise<{ ready: true; session: TestOpsSession | undefined } | { ready: false }> {
    let baseSession: TestOpsSession | undefined;

    try {
      if (needsBaseSession) {
        baseSession = await this.client.createSession(environment, this.reopenClosedLaunch);
      } else {
        await this.client.ensureLaunchOpen(this.reopenClosedLaunch);
      }
    } catch (error) {
      this.#skippedUploadCycle = true;

      if (this.client.isTestOpsClientError(error)) {
        this.logger.error(`Failed to create TestOps session: ${error.response.data.message}`);
        this.logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.logger.error(`Failed to create TestOps session: ${error.message}`);
      } else {
        this.logger.error("Failed to create TestOps session");
      }

      return { ready: false };
    }

    this.#skippedUploadCycle = false;

    return { ready: true, session: baseSession };
  }

  /**
   * Returns the session of an environment with own variables, creating it on first use.
   * The launch has already been checked in the same upload cycle, so the session is created without checking it again.
   */
  async environmentSession(environmentId: string, environment: Record<string, unknown>) {
    const cached = this.#environmentSessions.get(environmentId);

    if (cached) {
      return cached;
    }

    const session = await this.client.createSessionInOpenLaunch(environment);

    this.#environmentSessions.set(environmentId, session);

    return session;
  }

  async #reopenLaunchIfClosed(error: unknown): Promise<void> {
    if (!this.reopenClosedLaunch || !isClosedLaunchError(error)) {
      return;
    }

    const launchId = this.client.launchId;

    if (launchId === undefined) {
      return;
    }

    try {
      this.logger.warn(`Launch ${launchId} was closed - reopening before retrying the upload…`);
      await this.client.reopenLaunch(launchId);
    } catch (reopenError) {
      this.logger.debug(`Failed to reopen launch ${launchId}: ${reopenError}`);
    }
  }

  #logDeferredUpload(label: string, error?: unknown) {
    this.logger.warn(
      error
        ? `TestOps upload is unavailable; ${label} will be retried during finalization. Reason: ${error}`
        : `TestOps upload is suspended; ${label} will be retried during finalization.`,
    );
  }

  #retryHooks(label: string) {
    return {
      onRetry: async (error: unknown, attempt: number) => {
        this.logger.debug(`Retrying ${label} upload (attempt ${attempt}): ${error}`);
        await this.#reopenLaunchIfClosed(error);
      },
      onDeferred: (error?: unknown) => this.#logDeferredUpload(label, error),
    };
  }

  #logUploadFailure(label: string, error: unknown) {
    if (this.client.isTestOpsClientError(error)) {
      this.logger.error(`Failed to upload ${label}: ${error.response.data.message}`);
      this.logger.debug(error.response?.data);
    } else if (error instanceof Error) {
      this.logger.error(`Failed to upload ${label}: ${error.message}`);
    } else {
      this.logger.error(`Failed to upload ${label}`);
    }
  }

  async uploadGlobalAttachments(
    attachments: GlobalAttachmentLink[],
    attachmentsResolver: (attachment: AttachmentLink) => Promise<AttachmentForUpload | undefined>,
  ) {
    if (attachments.length === 0) {
      this.logger.debug("No new global attachments to upload");
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
          this.client.uploadGlobalAttachments({
            attachments,
            attachmentsResolver,
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

  async uploadGlobalErrors(results: TestError[]) {
    if (results.length === 0) {
      this.logger.verbose("No new global errors to upload");
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
          this.client.uploadGlobalErrors(results, (percent) => {
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

  async uploadTestResults(
    trsToUpload: TestOpsUploadTestResult[],
    environments: EnvironmentIdentity[],
    options: {
      attachmentsResolver: AttachmentsResolver;
      fixturesResolver: FixtureResolver;
      silent?: boolean;
      queueName: string;
      session: () => Promise<TestOpsSession>;
      environmentName?: string;
    },
  ) {
    const totalCount = trsToUpload.length;
    const forEnvironment = options.environmentName ? ` for environment ${options.environmentName}` : "";
    const label = `test results${forEnvironment}`;

    this.logger.verbose(
      `Preparing to upload ${bold(totalCount.toString())} ${totalCount > 1 ? "test results" : "test result"}${forEnvironment}`,
    );

    const progressLogger = createProgressLogger({
      total: totalCount,
      message: `Uploading ${label}`,
      unitLabel: totalCount === 1 ? "test result uploaded" : "test results uploaded",
      prefix: "[TestOpsPlugin]",
      silent: !!options.silent,
    });

    try {
      progressLogger.log(true);

      const { onRetry, onDeferred } = this.#retryHooks(label);

      const result = await this.#uploadQueue.run(
        options.queueName,
        async () =>
          this.client.uploadTestResults({
            session: await options.session(),
            attachmentsResolver: options.attachmentsResolver,
            fixturesResolver: options.fixturesResolver,
            environments,
            trs: trsToUpload.filter((tr) => !this.hasUploadedTestResult(tr.id)),
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
        this.logger.verbose("No test results were uploaded");
        return;
      }

      this.logger.info(
        `Uploaded ${uploadedCount} ${uploadedCount > 1 ? "test results" : "test result"}${forEnvironment}`,
      );
    } catch (error) {
      this.#logUploadFailure(label, error);
    } finally {
      progressLogger.cancel?.();
    }
  }

  async uploadQualityGateResults(results: AllureQualityGateResult[]) {
    const uniqueResults = uniqBy(
      results.filter(({ status }) => status === "failed"),
      ({ key, environment }) => `${key}-${environment}`,
    );

    if (uniqueResults.length === 0) {
      this.logger.verbose("No quality gate results to upload");
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
          this.client.uploadQualityGateResults(uniqueResults, (percent) => {
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

  async finishUpload(ci: CiDescriptor, status: TestStatus, autocloseLaunch: boolean) {
    const stillPending = await this.#uploadQueue.flush({
      onRetry: async (error, attempt) => {
        this.logger.debug(`Retrying deferred TestOps upload at finalization (attempt ${attempt}): ${error}`);
        await this.#reopenLaunchIfClosed(error);
      },
    });

    if (stillPending.length > 0) {
      this.logger.error(
        `${stillPending.length} TestOps upload(s) could not be completed after retrying at finalization: ${stillPending.join(", ")}`,
      );
    }

    try {
      await this.client.stopUpload(ci, status);
    } catch (error) {
      if (this.client.isTestOpsClientError(error)) {
        this.logger.error(`Failed to stop TestOps upload: ${error.response.data.message}`);
        this.logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.logger.error(`Failed to stop TestOps upload: ${error.message}`);
      } else {
        this.logger.error("Failed to stop TestOps upload");
      }
    }

    const launchId = this.client.launchId;

    if (typeof launchId !== "number") {
      return;
    }

    if (!autocloseLaunch) {
      this.logger.info(`Upload finished. Allure TestOps Launch: ${this.client.launchUrl}`);
      return;
    }

    const failedUploads = this.#uploadQueue.failedNames;

    if (failedUploads.length > 0) {
      this.logger.error(`${failedUploads.length} TestOps upload(s) failed: ${failedUploads.join(", ")}`);
    }

    if (stillPending.length > 0 || failedUploads.length > 0 || this.#skippedUploadCycle) {
      this.logger.warn(
        `Not closing launch ${launchId}: some uploads never made it to TestOps, closing now would report an incomplete launch as finished.`,
      );
      return;
    }

    let launchIsReady = false;

    for (let attempt = 0; attempt < LAUNCH_PROGRESS_ATTEMPTS_LIMIT; attempt += 1) {
      launchIsReady = await this.client.checkLaunchProgress();

      if (launchIsReady) {
        break;
      }

      if (attempt < LAUNCH_PROGRESS_ATTEMPTS_LIMIT - 1) {
        await new Promise((resolve) => setTimeout(resolve, LAUNCH_PROGRESS_POLL_DELAY_MS));
      }
    }

    if (launchIsReady) {
      try {
        await this.client.closeLaunch(launchId);
      } catch (err) {
        if (err instanceof Error) {
          this.logger.debug(`Failed to close launch: ${err.message}`);
        } else {
          this.logger.debug("Failed to close launch");
        }
      }
    }

    this.logger.info(`Upload finished. Allure TestOps Launch: ${this.client.launchUrl}`);
  }
}
