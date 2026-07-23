import { env } from "node:process";

import { detect, isLocalCiDescriptor } from "@allurereport/ci";
import { createProgressLogger } from "@allurereport/cli-commons";
import type { CategoryDefinition, EnvironmentIdentity, TestStatus } from "@allurereport/core-api";
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
import { LaunchGitFlow, resolveGitFlowOptions } from "./gitFlow/index.js";
import { Logger } from "./logger.js";
import type { TestOpsPluginTestResult, TestOpsPluginOptions, UploadCategory } from "./model.js";
import { uploadFilenameForLink } from "./utils/attachments.js";
import { toUploadCategory } from "./utils/categories.js";
import { resolvePluginOptions } from "./utils/options.js";
import { attachmentsResolverFactory, fixturesResolverFactory, unwrapStepsAttachments } from "./utils/resolvers.js";
import { validateExecutableName } from "./utils/validation.js";

const LAUNCH_PROGRESS_POLL_DELAY_MS = 500;
const LAUNCH_PROGRESS_ATTEMPTS_LIMIT = 10;

const categoryDisplayName = (cat: UploadCategory): string =>
  cat.name ?? cat.grouping?.[0]?.name ?? cat.grouping?.[0]?.value ?? cat.grouping?.[0]?.key ?? cat.externalId;

export class TestOpsPlugin implements Plugin {
  #logger = new Logger("TestOpsPlugin");
  #ci = detect();
  #client!: TestOpsClient;
  #launchName: string = "";
  #launchTags: string[] = [];
  #uploadedTestResultsIds: Set<string> = new Set();
  #uploadedGlobalAttachmentIds: Set<string> = new Set();
  #uploadedGlobalErrorsCount = 0;
  #autocloseLaunch: boolean = false;
  #gitFlow!: LaunchGitFlow;
  #enabledByConfig: boolean = false;

  constructor(
    readonly options: TestOpsPluginOptions,
    context: PluginConstructorContext = {},
  ) {
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
    } = resolvePluginOptions(options);

    // don't initialize the client when some options are missing
    // we can' throw an error here because it would break the report execution flow
    if ([accessToken, endpoint, projectId].every(Boolean)) {
      this.#client = new TestOpsClient({
        baseUrl: endpoint,
        accessToken,
        projectId,
      });
      this.#launchName = launchName;
      this.#launchTags = launchTags;
    }

    this.#autocloseLaunch = autocloseLaunch;
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

    return isEnabled(env.ALLURE_TESTOPS_ENABLED) || isEnabled(env.CI);
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

      await this.#client.uploadQualityGateResults(uniqueResults, (percent) => {
        if (!completed && percent >= 100) {
          completed = true;
          progressLogger.increment();
        }
      });

      if (!completed) {
        progressLogger.increment();
      }

      progressLogger.log(true);
    } catch (error) {
      if (this.#client.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to upload quality gate results: ${error.response.data.message}`);
        this.#logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to upload quality gate results: ${error.message}`);
      } else {
        this.#logger.error("Failed to upload quality gate results");
      }
    } finally {
      progressLogger.cancel?.();
    }
  }

  async #uploadGlobalErrors(store: AllureStore) {
    const allResults = await store.allGlobalErrors();
    // append-only store, so anything before the already-uploaded count is a repeat
    const results = allResults.slice(this.#uploadedGlobalErrorsCount);

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
      await this.#client.uploadGlobalErrors(results, (percent) => {
        if (!completed && percent >= 100) {
          completed = true;
          progressLogger.increment();
        }
      });

      if (!completed) {
        progressLogger.increment();
      }

      this.#uploadedGlobalErrorsCount = allResults.length;

      progressLogger.log(true);
    } catch (error) {
      if (this.#client.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to upload global errors: ${error.response.data.message}`);
        this.#logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to upload global errors: ${error.message}`);
      } else {
        this.#logger.error("Failed to upload global errors");
      }
    } finally {
      progressLogger.cancel?.();
    }
  }

  async #uploadGlobalAttachments(store: AllureStore) {
    const allAttachments = await store.allGlobalAttachments();
    const attachments = allAttachments.filter((attachment) => !this.#uploadedGlobalAttachmentIds.has(attachment.id));

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
      await this.#client.uploadGlobalAttachments({
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
          };
        },
        onProgress: (percent) => {
          if (!completed && percent >= 100) {
            completed = true;
            progressLogger.increment();
          }
        },
      });

      if (!completed) {
        progressLogger.increment();
      }

      attachments.forEach((attachment) => {
        this.#uploadedGlobalAttachmentIds.add(attachment.id);
      });

      progressLogger.log(true);
    } catch (error) {
      if (this.#client.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to upload global attachments: ${error.response.data.message}`);
        this.#logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to upload global attachments: ${error.message}`);
      } else {
        this.#logger.error("Failed to upload global attachments");
      }
    } finally {
      progressLogger.cancel?.();
    }
  }

  async #uploadTestResults(
    store: AllureStore,
    trsToUpload: TestOpsPluginTestResult[],
    environments: EnvironmentIdentity[],
  ) {
    const totalCount = trsToUpload.length;

    this.#logger.info(
      `Preparing to upload ${bold(totalCount.toString())} ${totalCount > 1 ? "test results" : "test result"}`,
    );

    const progressLogger = createProgressLogger({
      total: totalCount,
      message: "Uploading test results",
      unitLabel: totalCount === 1 ? "test result uploaded" : "test results uploaded",
      prefix: "[TestOpsPlugin]",
    });
    const logProgress = progressLogger.log;
    const incrementProgress = progressLogger.increment;

    try {
      logProgress(true);

      const uploadedTrs = await this.#client.uploadTestResults({
        attachmentsResolver: attachmentsResolverFactory(store),
        fixturesResolver: fixturesResolverFactory(store),
        environments,
        trs: trsToUpload,
        onProgress: () => incrementProgress(),
      });

      logProgress(true);

      uploadedTrs.forEach((tr) => {
        this.#uploadedTestResultsIds.add(tr.id);
      });

      const uploadedCount = uploadedTrs.length;

      if (uploadedCount === 0) {
        this.#logger.warn("No test results were uploaded");
        return;
      }

      this.#logger.info(`Uploaded ${uploadedCount} ${uploadedCount > 1 ? "test results" : "test result"}`);
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

    if (trsToUpload.length === 0) {
      if (stage == "update") {
        this.#logger.info("No new test results to upload");
      }

      if (stage === "done") {
        this.#logger.info("No test results to upload");
      }

      return;
    }

    if (stage === "update") {
      this.#logger.info(
        `Found ${bold(trsToUpload.length.toString())} new test ${trsToUpload.length > 1 ? "results" : "result"}, uploading…`,
      );
    }

    await this.#client.createSession(env);
    await this.#uploadGlobalAttachments(store);
    await this.#uploadGlobalErrors(store);
    await this.#uploadQualityGateResults(store);

    const environments = await store.allEnvironmentIdentities();
    const contextCategories = context?.categories ?? [];
    const trsEnrichedWithCategories = await this.#enrichWithCategories(store, trsToUpload, contextCategories);

    await this.#syncLaunchCategories(trsEnrichedWithCategories, contextCategories);
    await this.#uploadTestResults(store, trsEnrichedWithCategories, environments);
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

  async #enrichWithCategories(
    store: AllureStore,
    trs: TestOpsPluginTestResult[],
    contextCategories: CategoryDefinition[],
  ): Promise<TestOpsPluginTestResult[]> {
    return Promise.all(
      trs.map(async (tr) => {
        const environmentId = await store.environmentIdByTrId(tr.id);
        const base = {
          ...tr,
          ...(environmentId ? { environment: environmentId } : {}),
          steps: unwrapStepsAttachments(tr.steps),
        };
        const category = toUploadCategory(base, contextCategories ?? []);

        if (category) {
          base.category = category;
        }

        return base;
      }),
    );
  }

  async #syncLaunchCategories(trs: TestOpsPluginTestResult[], contextCategories: CategoryDefinition[]): Promise<void> {
    const categoryNamesByExternalId = this.#collectCategoryNamesByExternalId(trs);

    if (categoryNamesByExternalId.size === 0) {
      return;
    }

    const bulkItems: { externalId: string; name: string; hide?: boolean; expand?: boolean }[] = [];
    const seenExternalIds = new Set<string>();

    for (const tr of trs) {
      const cat = tr.category;
      if (!cat?.externalId) continue;
      if (seenExternalIds.has(cat.externalId)) continue;
      seenExternalIds.add(cat.externalId);

      bulkItems.push({
        externalId: cat.externalId,
        name: categoryNamesByExternalId.get(cat.externalId) ?? categoryDisplayName(cat),
        hide: cat.hide,
        expand: cat.expand,
      });
    }

    const rankByExternalId = new Map<string, number>();
    for (const c of contextCategories) {
      // Prefer canonical ids, but allow ordering by name for categories originating from `tr.categories`
      if (!rankByExternalId.has(c.id)) {
        rankByExternalId.set(c.id, c.index);
      }
      if (!rankByExternalId.has(c.name)) {
        rankByExternalId.set(c.name, c.index);
      }
    }

    const ranked = bulkItems.map((item, i) => ({
      item,
      i,
      rank: rankByExternalId.get(item.externalId),
    }));

    ranked.sort((a, b) => {
      const ar = a.rank ?? Number.POSITIVE_INFINITY;
      const br = b.rank ?? Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      return a.i - b.i; // stable for unknown ranks
    });

    const orderedBulkItems = ranked.map((r) => r.item);

    const launchId = this.#client.launchId;

    try {
      const created = await this.#client.createLaunchCategoriesBulk(launchId!, orderedBulkItems);
      const categoryIdByExternalId = new Map(created.map((r) => [r.externalId, r.id]));

      this.#assignCreatedCategoryIds(trs, categoryIdByExternalId);
    } catch {
      // ignore
    }
  }

  #collectCategoryNamesByExternalId(trs: TestOpsPluginTestResult[]): Map<string, string> {
    const map = new Map<string, string>();

    for (const tr of trs) {
      const cat = tr.category;

      if (cat?.externalId) {
        map.set(cat.externalId, categoryDisplayName(cat));
      }
    }

    return map;
  }

  #assignCreatedCategoryIds(trs: TestOpsPluginTestResult[], idByExternalId: Map<string, number>): void {
    for (const tr of trs) {
      const cat = tr.category;

      if (!cat?.externalId) {
        continue;
      }

      const id = idByExternalId.get(cat.externalId);

      if (typeof id === "number") {
        tr.category = { ...cat, id };
      }
    }
  }

  async #startUpload() {
    const launchGitContext = this.#gitFlow.resolve();

    await this.#client.createLaunch(this.#launchName, this.#launchTags, launchGitContext);

    await this.#client.startUpload(this.#ci!);
  }

  async #stopUpload(status: TestStatus) {
    await this.#client.stopUpload(this.#ci!, status);
  }

  async start(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return;
    }

    this.#logger.verbose("Starting upload…");

    await this.#startUpload();
    await this.#upload(store, { context, stage: "start" });

    this.#logger.info(`Allure TestOps Launch: ${this.#client.launchUrl}`);
  }

  async update(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return;
    }

    this.#logger.verbose("Updating (uploading new results)…");

    await this.#upload(store, { context, stage: "update" });
  }

  async done(context: PluginContext, store: AllureStore) {
    if (!this.enabled) {
      return;
    }

    const allTrs = await store.allTestResults({
      filter: this.options.filter,
      includeRetries: false,
    });

    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));

    this.#logger.verbose("Finalizing upload…");

    await this.#upload(store, { context, stage: "done" });
    await this.#stopUpload(worstStatus || "unknown");

    const launchId = this.#client.launchId;

    if (typeof launchId !== "number") {
      return;
    }

    if (!this.#autocloseLaunch) {
      this.#logger.info(`Upload finished. Allure TestOps Launch: ${this.#client.launchUrl}`);
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
