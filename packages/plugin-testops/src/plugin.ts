import { env } from "node:process";

import { detect } from "@allurereport/ci";
import type { CiDescriptor, TestStatus } from "@allurereport/core-api";
import { getWorstStatus } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  createPluginSummary,
} from "@allurereport/plugin-api";
import ProgressBar from "progress";

import { TestOpsClient } from "./client.js";
import type {
  TestResultWithUploadCategory,
  TestopsPluginOptions,
  UploadCategory,
  UploadTestResultsParams,
} from "./model.js";
import { toUploadCategory } from "./uploadCategory.js";
import { log, resolvePluginOptions, unwrapStepsAttachments } from "./utils.js";

const categoryDisplayName = (cat: UploadCategory): string =>
  cat.name ?? cat.grouping?.[0]?.name ?? cat.grouping?.[0]?.value ?? cat.grouping?.[0]?.key ?? cat.externalId;

export class TestopsPlugin implements Plugin {
  #ci?: CiDescriptor;
  #client?: TestOpsClient;
  #launchName: string = "";
  #launchTags: string[] = [];
  #uploadedTestResultsIds: string[] = [];
  #createdEnvironments: string[] = [];
  #autocloseLaunch: boolean;

  constructor(readonly options: TestopsPluginOptions) {
    const { accessToken, endpoint, projectId, launchName, launchTags, autocloseLaunch } = resolvePluginOptions(options);

    this.#ci = detect();

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
    this.#autocloseLaunch = autocloseLaunch ?? true;

    if (!accessToken) {
      log("Access token is missing. Please provide a valid access token in the plugin options.");
    }

    if (!endpoint) {
      log("Endpoint is missing. Please provide a valid endpoint in the plugin options.");
    }

    if (!projectId) {
      log("Project ID is missing. Please provide a valid project ID in the plugin options.");
    }
  }

  get ciMode() {
    return this.#ci && this.#ci.type !== "local";
  }

  async #upload(store: AllureStore, options?: { issueNewToken?: boolean; context?: PluginContext }) {
    const { issueNewToken = true } = options ?? {};
    const newEnvironments = (await store.allEnvironments()).filter((env) => !this.#createdEnvironments.includes(env));
    const contextCategories = options?.context?.categories ?? [];
    const allGlobalErrors = await store.allGlobalErrors();
    const allGlobalAttachments = await store.allGlobalAttachments();

    const trsToUpload = await this.#trsToUpload(store);
    if (trsToUpload.length === 0) {
      log("No new test results to upload");
      return;
    }

    log(`Preparing to upload ${trsToUpload.length} test result(s)`);
    const allTrsWithAttachments = this.#enrichWithCategories(trsToUpload, contextCategories);

    if (issueNewToken) {
      await this.#client!.issueOauthToken();
    }

    await this.#client!.createSession(env);

    if (allGlobalAttachments.length > 0) {
      await this.#client!.uploadGlobalAttachments({
        attachments: allGlobalAttachments,
        attachmentsResolver: async (attachmentLink) => {
          const content = await store.attachmentContentById(attachmentLink.id);
          const body = content ? await content.readContent(async (stream) => stream) : undefined;
          const originalFileName = attachmentLink.originalFileName;

          if (originalFileName === undefined || body === undefined) {
            return undefined;
          }

          return {
            originalFileName,
            contentType: attachmentLink.contentType ?? "application/octet-stream",
            content: body,
          };
        },
      });
    }

    if (allGlobalErrors.length > 0) {
      await this.#client!.uploadGlobalErrors(allGlobalErrors);
    }

    const trsProgressBar = new ProgressBar("Uploading test results [:bar] :current/:total", {
      total: allTrsWithAttachments.length,
      width: 20,
    });

    trsProgressBar.render();
    await this.#syncLaunchCategories(allTrsWithAttachments);
    await this.#client!.uploadTestResults(this.#buildUploadParams(store, allTrsWithAttachments, trsProgressBar));

    this.#uploadedTestResultsIds.push(...allTrsWithAttachments.map((tr) => tr.id));
    this.#createdEnvironments.push(...newEnvironments);
    log(`Successfully uploaded ${allTrsWithAttachments.length} test result(s)`);
  }

  async #trsToUpload(store: AllureStore): Promise<TestResultWithUploadCategory[]> {
    const allTrs = await store.allTestResults();
    return allTrs.filter((tr) => {
      const uploaded = this.#uploadedTestResultsIds.includes(tr.id);
      return this.options.filter ? this.options.filter(tr) && !uploaded : !uploaded;
    }) as TestResultWithUploadCategory[];
  }

  #enrichWithCategories(
    trs: TestResultWithUploadCategory[],
    contextCategories: PluginContext["categories"],
  ): TestResultWithUploadCategory[] {
    return trs.map((tr) => {
      const base = { ...tr, steps: unwrapStepsAttachments(tr.steps) };
      const category = toUploadCategory(tr, contextCategories ?? []);
      return category ? { ...base, category } : base;
    });
  }

  async #syncLaunchCategories(trs: TestResultWithUploadCategory[]): Promise<void> {
    const launchId = this.#client!.launchId;
    if (launchId === undefined || launchId === null) return;

    const categoryNamesByExternalId = this.#collectCategoryNamesByExternalId(trs);
    if (categoryNamesByExternalId.size === 0) return;

    try {
      const bulkItems = [...categoryNamesByExternalId.entries()].map(([externalId, name]) => ({
        externalId,
        name,
      }));
      const created = await this.#client!.createLaunchCategoriesBulk(launchId, bulkItems);
      const categoryIdByExternalId = new Map(created.map((r) => [r.externalId, r.id]));
      this.#assignCreatedCategoryIds(trs, categoryIdByExternalId);
    } catch {
      // ignore
    }
  }

  #collectCategoryNamesByExternalId(trs: TestResultWithUploadCategory[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const tr of trs) {
      const cat = tr.category;
      if (cat?.externalId) {
        map.set(cat.externalId, categoryDisplayName(cat));
      }
    }
    return map;
  }

  #assignCreatedCategoryIds(trs: TestResultWithUploadCategory[], idByExternalId: Map<string, number>): void {
    for (const tr of trs) {
      const cat = tr.category;
      if (cat?.externalId) {
        const id = idByExternalId.get(cat.externalId);
        if (id !== undefined && id !== null) {
          tr.category = { ...cat, id };
        }
      }
    }
  }

  #buildUploadParams(
    store: AllureStore,
    trs: TestResultWithUploadCategory[],
    progressBar: ProgressBar,
  ): UploadTestResultsParams {
    return {
      trs,
      onProgress: () => progressBar.tick(),
      attachmentsResolver: async (tr) => {
        const attachments = await store.attachmentsByTrId(tr.id);
        const resolved = await Promise.all(
          attachments.map(async (attachment) => {
            const content = await store.attachmentContentById(attachment.id);
            const body = content ? await content.readContent(async (s) => s) : undefined;
            const name = attachment.originalFileName ?? attachment.name;
            const type = attachment.contentType ?? "application/octet-stream";
            if (name === undefined || body === undefined) return null;
            return {
              originalFileName: name,
              contentType: type,
              content: body,
            };
          }),
        );
        return resolved.filter((a): a is NonNullable<typeof a> => a !== null);
      },
      fixturesResolver: async (tr) => {
        const fxts = await store.fixturesByTrId(tr.id);
        return fxts.map((fxt) => ({
          ...fxt,
          type: fxt.type.toUpperCase(),
          steps: unwrapStepsAttachments(fxt.steps),
        }));
      },
    };
  }

  async #startUpload() {
    if (!this.#client) {
      return;
    }

    await this.#client.issueOauthToken();
    await this.#client.createLaunch(this.#launchName, this.#launchTags);

    if (!this.ciMode) {
      return;
    }

    await this.#client.startUpload(this.#ci!);
  }

  async #stopUpload(status: TestStatus) {
    if (!this.ciMode || !this.#client) {
      return;
    }

    await this.#client.stopUpload(this.#ci!, status);
  }

  async start(_context: PluginContext, store: AllureStore) {
    if (!this.#client) {
      return;
    }

    log("Starting upload…");
    await this.#startUpload();
    await this.#upload(store, { issueNewToken: false, context: _context });
    log(`Launch: ${this.#client.launchUrl}`);
  }

  async update(_context: PluginContext, store: AllureStore) {
    if (!this.#client) {
      return;
    }

    log("Updating (uploading new results)…");
    await this.#upload(store, { context: _context });
  }

  async done(_context: PluginContext, store: AllureStore) {
    if (!this.#client) {
      return;
    }

    const allTrs = (await store.allTestResults()).filter((tr) =>
      this.options.filter ? this.options.filter(tr) : true,
    );
    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));

    log("Finalizing upload…");
    await this.#upload(store, { context: _context });
    await this.#stopUpload(worstStatus || "unknown");
    if (this.#autocloseLaunch) {
      const launchId = this.#client.launchId;
      if (launchId !== undefined && launchId !== null) {
        try {
          await this.#client.closeLaunch(launchId);
        } catch (err) {}
      }
    }
    log("Upload finished. Launch:", this.#client.launchUrl);
  }

  async info(context: PluginContext, store: AllureStore): Promise<PluginSummary | undefined> {
    if (!this.#client?.launchUrl) {
      return undefined;
    }

    return {
      ...(await createPluginSummary({
        name: this.#launchName,
        plugin: "TestOps",
        meta: {
          reportId: context.reportUuid,
        },
        filter: this.options.filter,
        history: context.history,
        ci: context.ci,
        store,
      })),
      remoteHref: this.#client.launchUrl,
    };
  }
}
