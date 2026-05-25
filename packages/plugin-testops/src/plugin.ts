import { env } from "node:process";

import { detect } from "@allurereport/ci";
import { Logger } from "@allurereport/cli-commons";
import type { CategoryDefinition, CiDescriptor, EnvironmentIdentity, HistoryDataPoint, TestStatus } from "@allurereport/core-api";
import { getWorstStatus } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  createPluginSummary,
} from "@allurereport/plugin-api";
import { AllureTestOpsClient } from "@allurereport/service";
import { uniqBy, stubTrue } from "lodash-es";
import pLimit from "p-limit";
import { bold } from "yoctocolors";

import { TestOpsClient } from "./client.js";
import type { TestOpsPluginTestResult, TestOpsPluginOptions, UploadCategory } from "./model.js";
import { toUploadCategory } from "./uploadCategory.js";
import { uploadFilenameForLink } from "./uploaderDto.js";
import {
  attachmentsResolverFactory,
  fixturesResolverFactory,
  resolvePluginOptions,
  unwrapStepsAttachments,
} from "./utils.js";

const categoryDisplayName = (cat: UploadCategory): string =>
  cat.name ?? cat.grouping?.[0]?.name ?? cat.grouping?.[0]?.value ?? cat.grouping?.[0]?.key ?? cat.externalId;
const REPORT_UPLOAD_CONCURRENCY = 50;
const REMOTE_UPLOAD_MAX_ATTEMPTS = 5;
const REMOTE_UPLOAD_MAX_SIMULTANEOUS_FAILED = 5;

export class TestOpsPlugin implements Plugin {
  #logger = new Logger("TestOpsPlugin");
  #ci?: CiDescriptor;
  #testopsClient?: TestOpsClient;
  #launchName: string = "";
  #launchTags: string[] = [];
  #uploadedTestResultsIds: Set<string> = new Set();
  #autocloseLaunch: boolean;
  #reportClient?: AllureTestOpsClient;

  constructor(readonly options: TestOpsPluginOptions) {
    const {
      accessToken,
      endpoint,
      projectId,
      launchName,
      launchTags,
      createLaunch = true,
      autocloseLaunch = true,
      publish = false,
    } = resolvePluginOptions(options);

    this.#ci = detect();
    this.#launchName = launchName;
    this.#launchTags = launchTags;
    this.#autocloseLaunch = autocloseLaunch;

    if ([accessToken, endpoint, projectId].every(Boolean)) {
      // intialize the testops client when we need to create launch
      if (createLaunch) {
        this.#testopsClient = new TestOpsClient({
          baseUrl: endpoint,
          accessToken,
          projectId,
        });
      }

      // initialize report client when we need to publish the report using testops service api
      if (publish) {
        this.#reportClient = new AllureTestOpsClient({
          baseUrl: endpoint,
          accessToken,
          projectId,
        });
      }
    }

    if (!createLaunch && !publish) {
      this.#logger.warn("Both createLaunch and publish are disabled. The plugin will not upload any data.");
    }

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

  async #uploadQualityGateResults(store: AllureStore) {
    if (!this.#testopsClient) {
      return;
    }

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
      await this.#testopsClient.uploadQualityGateResults(uniqueResults, (percent, total) => {
        progressBar.update(percent / total);
      });
      progressBar.update(1);
      progressBar.terminate();
    } catch (error) {
      progressBar.terminate();

      if (this.#testopsClient.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to upload quality gate results: ${error.response.data.message}`);
        this.#logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to upload quality gate results: ${error.message}`);
      } else {
        this.#logger.error("Failed to upload quality gate results");
      }
    }
  }

  async #uploadGlobalErrors(store: AllureStore) {
    if (!this.#testopsClient) {
      return;
    }

    const results = await store.allGlobalErrors();

    if (results.length === 0) {
      this.#logger.verbose("No global errors to upload");
      return;
    }

    const progressBar = this.#logger.progressBar("Uploading global errors");

    try {
      progressBar.update(0);

      await this.#testopsClient.uploadGlobalErrors(results, (percent, total) => {
        progressBar.update(percent / total);
      });

      progressBar.update(1);
      progressBar.terminate();
    } catch (error) {
      progressBar.terminate();

      if (this.#testopsClient.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to upload global errors: ${error.response.data.message}`);
        this.#logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to upload global errors: ${error.message}`);
      } else {
        this.#logger.error("Failed to upload global errors");
      }
    }
  }

  async #uploadGlobalAttachments(store: AllureStore) {
    if (!this.#testopsClient) {
      return;
    }

    const attachments = await store.allGlobalAttachments();

    if (attachments.length === 0) {
      this.#logger.debug("No global attachments to upload");
      return;
    }

    const progressBar = this.#logger.progressBar("Uploading global attachments");

    try {
      progressBar.update(0);

      await this.#testopsClient.uploadGlobalAttachments({
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
        onProgress: (percent, total) => {
          progressBar.update(percent / total);
        },
      });

      progressBar.update(1);
      progressBar.terminate();
    } catch (error) {
      progressBar.terminate();

      if (this.#testopsClient.isTestOpsClientError(error)) {
        this.#logger.error(`Failed to upload global attachments: ${error.response.data.message}`);
        this.#logger.debug(error.response?.data);
      } else if (error instanceof Error) {
        this.#logger.error(`Failed to upload global attachments: ${error.message}`);
      } else {
        this.#logger.error("Failed to upload global attachments");
      }
    }
  }

  async #uploadTestResults(
    store: AllureStore,
    trsToUpload: TestOpsPluginTestResult[],
    environments: EnvironmentIdentity[],
  ) {
    if (!this.#testopsClient) {
      return;
    }

    const totalCount = trsToUpload.length;

    this.#logger.info(
      `Preparing to upload ${bold(totalCount.toString())} ${totalCount > 1 ? "test results" : "test result"}`,
    );

    const trsProgressBar = this.#logger.progressBarCounter("Uploading test results", totalCount);
    const uploadedTrs = await this.#testopsClient.uploadTestResults({
      attachmentsResolver: attachmentsResolverFactory(store),
      fixturesResolver: fixturesResolverFactory(store),
      environments,
      trs: trsToUpload,
      onProgress: () => trsProgressBar.tick(),
    });

    uploadedTrs.forEach((tr) => {
      this.#uploadedTestResultsIds.add(tr.id);
    });

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
    options = {} as {
      context?: PluginContext;
      stage: "start" | "update" | "done";
    },
  ) {
    if (!this.#testopsClient) {
      return;
    }

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

    await this.#testopsClient.createSession(env);
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

        return filter(tr);
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
    if (!this.#testopsClient) {
      return;
    }

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
    const launchId = this.#testopsClient.launchId;

    try {
      const created = await this.#testopsClient.createLaunchCategoriesBulk(launchId!, orderedBulkItems);
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
    if (!this.#testopsClient) {
      return;
    }

    await this.#testopsClient.createLaunch(this.#launchName, this.#launchTags);

    if (!this.ciMode) {
      return;
    }

    await this.#testopsClient.startUpload(this.#ci!);
  }

  async #stopUpload(status: TestStatus) {
    if (!this.#testopsClient || !this.ciMode) {
      return;
    }

    await this.#testopsClient.stopUpload(this.#ci!, status);
  }

  async start(context: PluginContext, store: AllureStore) {
    if (!this.#testopsClient) {
      return;
    }

    // TODO:

    // this.#logger.verbose("Starting upload…");

    // await this.#startUpload();
    // await this.#upload(store, { context, stage: "start" });

    // this.#logger.info(`Allure TestOps Launch: ${this.#testopsClient.launchUrl}`);
  }

  async update(context: PluginContext, store: AllureStore) {
    if (!this.#testopsClient) {
      return;
    }

    // TODO:

    // this.#logger.verbose("Updating (uploading new results)…");

    // await this.#upload(store, { context, stage: "update" });
  }

  async done(context: PluginContext, store: AllureStore) {
    if (!this.#testopsClient) {
      return;
    }

    // TODO:

    // const allTrs = await store.allTestResults({
    //   filter: this.options.filter,
    //   includeRetries: false,
    // });

    // const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));

    // this.#logger.verbose("Finalizing upload…");

    // await this.#upload(store, { context, stage: "done" });
    // await this.#stopUpload(worstStatus || "unknown");

    // const launchId = this.#testopsClient.launchId;

    // if (typeof launchId !== "number") {
    //   return;
    // }

    // if (!this.#autocloseLaunch) {
    //   this.#logger.info(`Upload finished. Allure TestOps Launch: ${this.#testopsClient.launchUrl}`);
    //   return;
    // }

    // try {
    //   await this.#testopsClient.closeLaunch(launchId);
    // } catch (err) {
    //   if (err instanceof Error) {
    //     this.#logger.debug(`Failed to close launch: ${err.message}`);
    //   } else {
    //     this.#logger.debug("Failed to close launch");
    //   }
    // }

    // this.#logger.info(`Upload finished. Allure TestOps Launch: ${this.#testopsClient.launchUrl}`);
  }

  async info(context: PluginContext, store: AllureStore) {
    if (!this.#testopsClient) {
      return undefined;
    }

    if (!this.#testopsClient.launchUrl) {
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

    summary.remoteHref = this.#testopsClient.launchUrl;

    return summary;
  }

  // TODO:
  async publish(params: {
    publisherContext: PluginContext;
    context: PluginContext;
    store: AllureStore;
    historyDataPoint?: HistoryDataPoint;
  }) {
    const { publisherContext, context, store, historyDataPoint } = params;

    if (!this.#reportClient) {
      return undefined;
    }

    const files = (await context.state.get("files")) ?? {};

    console.log("testops files to publish", files)


    // const reportsToPublish = context.reports.filter((report) => report.publish && Object.keys(report.files).length > 0);

    // if (reportsToPublish.length === 0) {
    //   return undefined;
    // }

    // await this.#reportClient.createReport({
    //   reportUuid: context.reportUuid,
    //   reportName: context.reportName,
    // });

    // const linksByPluginId: Record<string, string> = {};
    // const successfulPluginIds = new Set<string>();
    //
    const isReportFile = (filename: string) =>
      filename === "index.html" ||
      filename === "summary.json" ||
      filename.startsWith("data/") ||
      filename.startsWith("widgets/") ||
      filename.startsWith("history/");

    // for (const report of reportsToPublish) {
    //   const pluginFilesEntries = Object.entries(report.files);
    //   const progressBar = this.#logger.progressBarCounter(
    //     `Publishing "${report.pluginId}" report`,
    //     pluginFilesEntries.length,
    //   );
    //   const uploadAbortController = new AbortController();
    //   const failedUploads = new Set<string>();
    //   const limit = pLimit(REPORT_UPLOAD_CONCURRENCY);
    //   const uploadWithRetry = async (filename: string, uploadFn: () => Promise<void>) => {
    //     for (let attempt = 1; attempt <= REMOTE_UPLOAD_MAX_ATTEMPTS; attempt++) {
    //       if (uploadAbortController.signal.aborted) {
    //         return false;
    //       }

    //       try {
    //         await uploadFn();
    //         failedUploads.delete(filename);

    //         return true;
    //       } catch (error) {
    //         if (uploadAbortController.signal.aborted) {
    //           return false;
    //         }

    //         failedUploads.add(filename);

    //         if (failedUploads.size > REMOTE_UPLOAD_MAX_SIMULTANEOUS_FAILED || attempt >= REMOTE_UPLOAD_MAX_ATTEMPTS) {
    //           throw error;
    //         }
    //       }
    //     }

    //     return false;
    //   };
    //   const uploadTasks = pluginFilesEntries.map(([filename, filepath]) =>
    //     limit(async () => {
    //       if (uploadAbortController.signal.aborted) {
    //         return;
    //       }

    //       let fileUrl: string | undefined;
    //       const uploaded = await uploadWithRetry(filename, async () => {
    //         if (isReportFile(filename)) {
    //           fileUrl = await this.#reportClient!.addReportFile({
    //             reportUuid: context.reportUuid,
    //             pluginId: report.pluginId,
    //             filename,
    //             filepath,
    //             signal: uploadAbortController.signal,
    //           });
    //         } else {
    //           await this.#reportClient!.addReportAsset({ filename, filepath, signal: uploadAbortController.signal });
    //         }
    //       });

    //       if (!uploaded || uploadAbortController.signal.aborted) {
    //         return;
    //       }

    //       if (isReportFile(filename) && filename === "index.html" && fileUrl) {
    //         linksByPluginId[report.pluginId] = fileUrl;
    //       }

    //       progressBar.tick();
    //     }),
    //   );

    //   try {
    //     await Promise.all(uploadTasks);

    //     if (linksByPluginId[report.pluginId]) {
    //       successfulPluginIds.add(report.pluginId);
    //     }
    //   } catch (error) {
    //     uploadAbortController.abort();
    //     await Promise.allSettled(uploadTasks);

    //     delete linksByPluginId[report.pluginId];

    //     try {
    //       await this.#reportClient.deleteReport({
    //         reportUuid: context.reportUuid,
    //       });
    //     } catch (cleanupError) {
    //       this.#logger.error("Failed to clean up failed TestOps report upload");
    //       this.#logger.debug(
    //         cleanupError instanceof Error ? (cleanupError.stack ?? cleanupError.message) : String(cleanupError),
    //       );
    //     }

    //     this.#logger.error(`Plugin "${report.pluginId}" upload has failed, the plugin won't be published`);
    //     this.#logger.debug(error instanceof Error ? (error.stack ?? error.message) : String(error));

    //     return undefined;
    //   } finally {
    //     progressBar.terminate();
    //   }
    // }

    // if (successfulPluginIds.size === 0) {
    //   return undefined;
    // }

    // const summaryHref = context.summary
    //   ? await this.#reportClient.addReportFile({
    //       reportUuid: context.reportUuid,
    //       filename: "index.html",
    //       filepath: context.summary.filepath,
    //     })
    //   : undefined;

    // await this.#reportClient.completeReport({
    //   reportUuid: context.reportUuid,
    //   historyPoint: context.historyPoint,
    // });

    // const [firstPluginHref] = Object.values(linksByPluginId);
    // const remoteHref = summaryHref ?? firstPluginHref;

    // return {
    //   linksByPluginId,
    //   ...(remoteHref ? { remoteHref } : {}),
    // };

    return undefined;
  }
}
