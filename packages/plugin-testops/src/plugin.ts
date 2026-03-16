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
import type { TestopsPluginOptions } from "./model.js";
import { toUploadCategory } from "./uploadCategory.js";
import { resolvePluginOptions, unwrapStepsAttachments } from "./utils.js";

const LOG_PREFIX = "\x1b[92m[plugin-testops]\x1b[0m ";

export class TestopsPlugin implements Plugin {
  #ci?: CiDescriptor;
  #client?: TestOpsClient;
  #launchName: string = "";
  #launchTags: string[] = [];
  #uploadedTestResultsIds: string[] = [];
  #createdEnvironments: string[] = [];

  constructor(readonly options: TestopsPluginOptions) {
    const { accessToken, endpoint, projectId, launchName, launchTags } = resolvePluginOptions(options);

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

    if (!accessToken) {
      // eslint-disable-next-line no-console
      console.warn(`${LOG_PREFIX}Access token is missing. Please provide a valid access token in the plugin options.`);
    }

    if (!endpoint) {
      // eslint-disable-next-line no-console
      console.warn(`${LOG_PREFIX}Endpoint is missing. Please provide a valid endpoint in the plugin options.`);
    }

    if (!projectId) {
      // eslint-disable-next-line no-console
      console.warn(`${LOG_PREFIX}Project ID is missing. Please provide a valid project ID in the plugin options.`);
    }
  }

  get ciMode() {
    return this.#ci && this.#ci.type !== "local";
  }

  async #upload(store: AllureStore, options?: { issueNewToken?: boolean; context?: PluginContext }) {
    const { issueNewToken = true } = options ?? {};
    const newEnvironments = (await store.allEnvironments()).filter((env) => !this.#createdEnvironments.includes(env));
    const contextCategories = options?.context?.categories ?? [];
    const allTrs = await store.allTestResults();
    const allGlobalErrors = await store.allGlobalErrors();
    const allGlobalAttachments = await store.allGlobalAttachments();
    const trsToUpload = allTrs.filter((tr) => {
      const uploaded = this.#uploadedTestResultsIds.includes(tr.id);

      if (this.options.filter) {
        return this.options.filter(tr) && !uploaded;
      }

      return !uploaded;
    });

    if (trsToUpload.length === 0) {
      // eslint-disable-next-line no-console
      console.info(`${LOG_PREFIX}No new test results to upload`);
      return;
    }

    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX}Preparing to upload ${trsToUpload.length} test result(s)`);
    const allTrsWithAttachments = trsToUpload.map((tr) => {
      const base = { ...tr, steps: unwrapStepsAttachments(tr.steps) };
      const category = toUploadCategory(tr, contextCategories);
      return category ? { ...base, category } : base;
    });

    if (issueNewToken) {
      await this.#client!.issueOauthToken();
    }

    await this.#client!.createSession(env);

    if (allGlobalAttachments.length > 0) {
      await this.#client!.uploadGlobalAttachments({
        attachments: allGlobalAttachments,
        attachmentsResolver: async (attachmentLink) => {
          const content = await store.attachmentContentById(attachmentLink.id);

          return {
            // @ts-expect-error
            originalFileName: attachmentLink.name || attachmentLink.originalFileName,
            contentType: attachmentLink.contentType,
            content: await content?.readContent(async (s) => s),
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

    const launchId = this.#client!.launchId;
    if (launchId != null) {
      const byExternalId = new Map<string, string>();
      for (const tr of allTrsWithAttachments) {
        const cat = (
          tr as {
            category?: {
              externalId: string;
              name?: string;
              grouping?: { key?: string; value?: string; name?: string }[];
            };
          }
        ).category;
        if (cat?.externalId) {
          byExternalId.set(
            cat.externalId,
            cat.name ?? cat.grouping?.[0]?.name ?? cat.grouping?.[0]?.value ?? cat.grouping?.[0]?.key ?? cat.externalId,
          );
        }
      }
      if (byExternalId.size > 0) {
        try {
          const bulkItems = [...byExternalId.entries()].map(([externalId, name]) => ({ externalId, name }));
          const created = await this.#client!.createLaunchCategoriesBulk(launchId, bulkItems);
          const idByExternalId = new Map(created.map((r) => [r.externalId, r.id]));
          for (const tr of allTrsWithAttachments) {
            const cat = (tr as { category?: { externalId: string; grouping?: unknown[]; id?: number } }).category;
            if (cat?.externalId) {
              const id = idByExternalId.get(cat.externalId);
              if (id != null) {
                (tr as { category: { externalId: string; grouping?: unknown[]; id?: number } }).category = {
                  ...cat,
                  id,
                };
              }
            }
          }
        } catch (err) {}
      }
    }

    await this.#client!.createSession(env);
    await this.#client!.uploadTestResults({
      trs: allTrsWithAttachments,
      onProgress: () => trsProgressBar.tick(),
      attachmentsResolver: async (tr) => {
        const attachments = await store.attachmentsByTrId(tr.id);

        return await Promise.all(
          attachments.map(async (attachment) => {
            const content = await store.attachmentContentById(attachment.id);

            return {
              // @ts-expect-error
              originalFileName: attachmentLink.name || attachmentLink.originalFileName,
              contentType: attachment.contentType,
              content: await content?.readContent(async (s) => s),
            };
          }),
        );
      },
      fixturesResolver: async (tr) => {
        const fxts = await store.fixturesByTrId(tr.id);

        return fxts.map((fxt) => ({
          ...fxt,
          // testops accepts AFTER or BEFORE types
          type: fxt.type.toUpperCase(),
          steps: unwrapStepsAttachments(fxt.steps),
        }));
      },
    });

    // prevent duplicated test results upload
    this.#uploadedTestResultsIds.push(...allTrsWithAttachments.map((tr) => tr.id));
    this.#createdEnvironments.push(...newEnvironments);
    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX}Successfully uploaded ${allTrsWithAttachments.length} test result(s)`);
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

    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX}Starting upload…`);
    await this.#startUpload();
    await this.#upload(store, { issueNewToken: false, context: _context });
    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX}Launch: ${this.#client.launchUrl}`);
  }

  async update(_context: PluginContext, store: AllureStore) {
    if (!this.#client) {
      return;
    }

    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX}Updating (uploading new results)…`);
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

    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX}Finalizing upload…`);
    await this.#upload(store, { context: _context });
    await this.#stopUpload(worstStatus || "unknown");
    const launchId = this.#client.launchId;
    if (launchId != null) {
      try {
        await this.#client.closeLaunch(launchId);
      } catch (err) {}
    }
    // eslint-disable-next-line no-console
    console.info(`${LOG_PREFIX}Upload finished. Launch:`, this.#client.launchUrl);
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
