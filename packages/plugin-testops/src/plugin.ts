import { env } from "node:process";

import { detect } from "@allurereport/ci";
import type { CategoryDefinition, CiDescriptor, TestStatus } from "@allurereport/core-api";
import { getWorstStatus } from "@allurereport/core-api";
import { type AllureStore, type Plugin, type PluginContext, createPluginSummary } from "@allurereport/plugin-api";
import { isAxiosError } from "axios";
import { uniqBy, stubTrue } from "lodash-es";
import { bold } from "yoctocolors";

import { TestOpsClient } from "./client.js";
import { Logger } from "./logger.js";
import type { TestOpsPluginTestResult, TestOpsPluginOptions, UploadCategory } from "./model.js";
import { toUploadCategory } from "./uploadCategory.js";
import {
  attachmentsResolverFactory,
  fixturesResolverFactory,
  resolvePluginOptions,
  unwrapStepsAttachments,
} from "./utils.js";

const categoryDisplayName = (cat: UploadCategory): string =>
  cat.name ?? cat.grouping?.[0]?.name ?? cat.grouping?.[0]?.value ?? cat.grouping?.[0]?.key ?? cat.externalId;

export class TestOpsPlugin implements Plugin {
  #logger = new Logger("TestOpsPlugin");
  #ci?: CiDescriptor;
  // @ts-expect-error - if client is not initialized it will not be used
  #client: TestOpsClient;
  /**
   * If the plugin is enabled
   */
  #enabled: boolean = false;
  #launchName: string = "";
  #launchTags: string[] = [];
  #uploadedTestResultsIds: string[] = [];
  #autocloseLaunch: boolean;

  constructor(readonly options: TestOpsPluginOptions) {
    const {
      accessToken,
      endpoint,
      projectId,
      launchName,
      launchTags,
      autocloseLaunch = true,
    } = resolvePluginOptions(options);

    this.#ci = detect();

    // don't initialize the client when some options are missing
    // we can' throw an error here because it would break the report execution flow
    if ([accessToken, endpoint, projectId].every(Boolean)) {
      this.#enabled = true;
      this.#client = new TestOpsClient({
        baseUrl: endpoint,
        accessToken,
        projectId,
      });
      this.#launchName = launchName;
      this.#launchTags = launchTags;
    }

    this.#autocloseLaunch = autocloseLaunch;

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

  get ciMode() {
    return this.#ci && this.#ci.type !== "local";
  }

  async #uploadNamedEnvs(store: AllureStore) {
    const envs = await store.allEnvironments();

    // @TODO: USE IDS HERE
    // Filter out envs that already have been uploaded this session
    const envsToUpload = envs.filter((env) => !this.#client.namedEnvs.some((namedEnv) => namedEnv.externalId === env));

    if (envsToUpload.length === 0) {
      this.#logger.verbose("No named environments to upload");
      return;
    }

    const progressBar = this.#logger.progressBar("Uploading named environments");

    try {
      progressBar.update(0);
      await this.#client.createNamedEnvs(envsToUpload, (percent, total) => {
        progressBar.update(percent / total);
      });
      progressBar.update(1);
      progressBar.terminate();
      this.#logger.debug("Named environments uploaded");
      this.#logger.debug(Array.from(this.#client.namedEnvs));
    } catch (error) {
      progressBar.terminate();

      if (error instanceof Error) {
        if (this.#client.isTestOpsClientError(error)) {
          this.#logger.error(`Failed to upload named environments: ${error.response.data.message}`);
        } else {
          this.#logger.error(`Failed to upload named environments: ${error.message}`);
        }

        if (isAxiosError(error)) {
          this.#logger.debug(error.response?.data);
        }
      } else {
        this.#logger.error("Failed to upload named environments");
      }
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

    const progressBar = this.#logger.progressBar("Uploading quality gate results");

    try {
      progressBar.update(0);
      await this.#client.uploadQualityGateResults(uniqueResults, (percent, total) => {
        progressBar.update(percent / total);
      });
      progressBar.update(1);
      progressBar.terminate();
    } catch (error) {
      progressBar.terminate();

      if (error instanceof Error) {
        if (this.#client.isTestOpsClientError(error)) {
          this.#logger.error(`Failed to upload quality gate results: ${error.response.data.message}`);
        } else {
          this.#logger.error(`Failed to upload quality gate results: ${error.message}`);
        }

        if (isAxiosError(error)) {
          this.#logger.debug(error.response?.data);
        }
      } else {
        this.#logger.error("Failed to upload quality gate results");
      }
    }
  }

  async #uploadGlobalErrors(store: AllureStore) {
    const results = await store.allGlobalErrors();

    if (results.length === 0) {
      this.#logger.verbose("No global errors to upload");
      return;
    }

    const progressBar = this.#logger.progressBar("Uploading global errors");

    try {
      progressBar.update(0);
      await this.#client.uploadGlobalErrors(results, (percent, total) => {
        progressBar.update(percent / total);
      });
      progressBar.update(1);
      progressBar.terminate();
    } catch (error) {
      progressBar.terminate();

      if (error instanceof Error) {
        if (this.#client.isTestOpsClientError(error)) {
          this.#logger.error(`Failed to upload global errors: ${error.response.data.message}`);
        } else {
          this.#logger.error(`Failed to upload global errors: ${error.message}`);
        }

        if (isAxiosError(error)) {
          this.#logger.debug(error.response?.data);
        }
      } else {
        this.#logger.error("Failed to upload global errors");
      }
    }
  }

  async #uploadGlobalAttachments(store: AllureStore) {
    const attachments = await store.allGlobalAttachments();

    if (attachments.length === 0) {
      this.#logger.debug("No global attachments to upload");
      return;
    }

    const progressBar = this.#logger.progressBar("Uploading global attachments");

    try {
      progressBar.update(0);
      await this.#client.uploadGlobalAttachments({
        attachments,
        attachmentsResolver: async (attachmentLink) => {
          const content = await store.attachmentContentById(attachmentLink.id);
          const body = await content?.readContent(async (stream) => stream);
          // @ts-expect-error - don't know
          const attachmentName = attachmentLink.name ?? attachmentLink.originalFileName;

          if (attachmentName === undefined || body === undefined) {
            return undefined;
          }

          return {
            originalFileName: attachmentName,
            contentType: attachmentLink.contentType ?? "application/octet-stream",
            content: body,
          };
        },
        onProgress: (percent, total) => {
          progressBar.update(percent / total);
        },
      });
      progressBar.update(1);
      progressBar.terminate();
    } catch (error) {
      progressBar.terminate();

      if (error instanceof Error) {
        if (this.#client.isTestOpsClientError(error)) {
          this.#logger.error(`Failed to upload global attachments: ${error.response.data.message}`);
        } else {
          this.#logger.error(`Failed to upload global attachments: ${error.message}`);
        }

        if (isAxiosError(error)) {
          this.#logger.debug(error.response?.data);
        }
      } else {
        this.#logger.error("Failed to upload global attachments");
      }
    }
  }

  async #uploadTestResults(store: AllureStore, trsToUpload: TestOpsPluginTestResult[]) {
    const totalCount = trsToUpload.length;

    this.#logger.info(
      `Preparing to upload ${bold(totalCount.toString())} ${totalCount > 1 ? "test results" : "test result"}`,
    );

    const trsProgressBar = this.#logger.progressBarCounter("Uploading test results", totalCount);

    const uploadedTrs = await this.#client.uploadTestResults({
      attachmentsResolver: attachmentsResolverFactory(store),
      fixturesResolver: fixturesResolverFactory(store),
      trs: trsToUpload,
      onProgress: () => trsProgressBar.tick(),
    });

    this.#uploadedTestResultsIds.push(...uploadedTrs.map((tr) => tr.id));

    const uploadedCount = uploadedTrs.length;

    trsProgressBar.update(uploadedCount / totalCount);
    trsProgressBar.terminate();

    if (uploadedCount === 0) {
      this.#logger.warn("No test results were uploaded");
      return;
    }

    this.#logger.info(`Uploaded ${uploadedCount} ${uploadedCount > 1 ? "test results" : "test result"}`);
  }

  async #upload(
    store: AllureStore,
    options = {} as { issueNewToken?: boolean; context?: PluginContext; stage: "start" | "update" | "done" },
  ) {
    const { issueNewToken = true, context, stage } = options;

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

    if (issueNewToken) {
      this.#logger.verbose("Issuing new OAuth token");
      await this.#client.issueOauthToken();
    }

    await this.#client.createSession(env);

    await this.#uploadNamedEnvs(store);
    await this.#uploadGlobalAttachments(store);
    await this.#uploadGlobalErrors(store);
    await this.#uploadQualityGateResults(store);

    const trsEnrichedWithCategories = this.#enrichWithCategories(trsToUpload, context?.categories ?? []);
    await this.#syncLaunchCategories(trsEnrichedWithCategories);

    await this.#uploadTestResults(store, trsEnrichedWithCategories);
  }

  async #trsToUpload(store: AllureStore) {
    const filter = this.options.filter ?? stubTrue;

    const filteredTrs = await store.allTestResults({
      filter: (tr) => {
        const uploaded = this.#uploadedTestResultsIds.includes(tr.id);

        if (uploaded) {
          return false;
        }

        return filter(tr);
      },
      includeHidden: false,
    });

    return filteredTrs;
  }

  #enrichWithCategories(
    trs: TestOpsPluginTestResult[],
    contextCategories: CategoryDefinition[],
  ): TestOpsPluginTestResult[] {
    return trs.map((tr) => {
      const base = { ...tr, steps: unwrapStepsAttachments(tr.steps) };
      const category = toUploadCategory(tr, contextCategories ?? []);

      if (category) {
        base.category = category;
      }

      return base;
    });
  }

  async #syncLaunchCategories(trs: TestOpsPluginTestResult[]): Promise<void> {
    const categoryNamesByExternalId = this.#collectCategoryNamesByExternalId(trs);

    if (categoryNamesByExternalId.size === 0) {
      return;
    }

    const bulkItems: { externalId: string; name: string }[] = [];

    for (const [externalId, name] of categoryNamesByExternalId) {
      bulkItems.push({ externalId, name });
    }

    const launchId = this.#client.launchId;

    try {
      const created = await this.#client.createLaunchCategoriesBulk(launchId!, bulkItems);
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
    await this.#client.issueOauthToken();
    await this.#client.createLaunch(this.#launchName, this.#launchTags);

    if (!this.ciMode) {
      return;
    }

    await this.#client.startUpload(this.#ci!);
  }

  async #stopUpload(status: TestStatus) {
    if (!this.ciMode) {
      return;
    }

    await this.#client.stopUpload(this.#ci!, status);
  }

  async start(context: PluginContext, store: AllureStore) {
    if (!this.#enabled) {
      return;
    }

    this.#logger.verbose("Starting upload…");

    await this.#startUpload();
    await this.#upload(store, { issueNewToken: false, context, stage: "start" });

    this.#logger.info(`Allure TestOps Launch: ${this.#client.launchUrl}`);
  }

  async update(context: PluginContext, store: AllureStore) {
    if (!this.#enabled) {
      return;
    }

    this.#logger.verbose("Updating (uploading new results)…");

    await this.#upload(store, { context, stage: "update" });
  }

  async done(context: PluginContext, store: AllureStore) {
    if (!this.#enabled) {
      return;
    }

    const allTrs = await store.allTestResults({ filter: this.options.filter, includeHidden: false });

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

    try {
      await this.#client.closeLaunch(launchId);
    } catch (err) {
      if (err instanceof Error) {
        this.#logger.debug(`Failed to close launch: ${err.message}`);
      } else {
        this.#logger.debug("Failed to close launch");
      }
    }

    this.#logger.info(`Upload finished. Allure TestOps Launch: ${this.#client.launchUrl}`);
  }

  async info(context: PluginContext, store: AllureStore) {
    if (!this.#enabled) {
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
