import { detect } from "@allurereport/ci";
import type { CiDescriptor, TestStatus } from "@allurereport/core-api";
import { getWorstStatus } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  convertToSummaryTestResult,
} from "@allurereport/plugin-api";
import { env } from "node:process";
import { TestOpsClient } from "./client.js";
import type { TestopsUploaderPluginOptions } from "./model.js";
import { resolvePluginOptions, unwrapStepsAttachments } from "./utils.js";

export class TestopsUploaderPlugin implements Plugin {
  #ci?: CiDescriptor;
  #client?: TestOpsClient;
  #launchName: string = "";
  #launchTags: string[] = [];
  #uploadedTestResultsIds: string[] = [];

  constructor(readonly options: TestopsUploaderPluginOptions) {
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
      console.warn("TestOps access token is missing. Please provide a valid access token in the plugin options.");
    }

    if (!endpoint) {
      // eslint-disable-next-line no-console
      console.warn("TestOps endpoint is missing. Please provide a valid endpoint in the plugin options.");
    }

    if (!projectId) {
      // eslint-disable-next-line no-console
      console.warn("TestOps project ID is missing. Please provide a valid project ID in the plugin options.");
    }
  }

  get ciMode() {
    return this.#ci && this.#ci.type !== "local";
  }

  async #upload(store: AllureStore, options?: { issueNewToken: boolean }) {
    const { issueNewToken = true } = options ?? {};
    const allTrs = await store.allTestResults();
    const trsToUpload = allTrs.filter((tr) => {
      const uploaded = this.#uploadedTestResultsIds.includes(tr.id);

      if (this.options.filter) {
        return this.options.filter(tr) && !uploaded;
      }

      return !uploaded;
    });

    if (trsToUpload.length === 0) {
      return;
    }

    const allTrsWithAttachments = trsToUpload.map((tr) => {
      return {
        ...tr,
        steps: unwrapStepsAttachments(tr.steps),
      };
    });

    if (issueNewToken) {
      await this.#client!.issueOauthToken();
    }

    await this.#client!.createSession(env);
    await this.#client!.uploadTestResults({
      trs: allTrsWithAttachments,
      attachmentsResolver: async (tr) => {
        const attachments = await store.attachmentsByTrId(tr.id);

        return await Promise.all(
          attachments.map(async (attachment) => {
            const content = await store.attachmentContentById(attachment.id);

            return {
              originalFileName: attachment.originalFileName,
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

    await this.#startUpload();
    await this.#upload(store, { issueNewToken: false });

    // eslint-disable-next-line no-console
    console.info(`TestOps launch has been created: ${this.#client.launchUrl}`);
  }

  async update(_context: PluginContext, store: AllureStore) {
    if (!this.#client) {
      return;
    }

    await this.#upload(store);
  }

  async done(_context: PluginContext, store: AllureStore) {
    if (!this.#client) {
      return;
    }

    const allTrs = (await store.allTestResults()).filter((tr) =>
      this.options.filter ? this.options.filter(tr) : true,
    );
    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));

    await this.#upload(store);
    await this.#stopUpload(worstStatus || "unknown");
  }

  async info(context: PluginContext, store: AllureStore): Promise<PluginSummary | undefined> {
    if (!this.#client?.launchUrl) {
      return undefined;
    }

    const allTrs = (await store.allTestResults()).filter((tr) =>
      this.options.filter ? this.options.filter(tr) : true,
    );
    const newTrs = await store.allNewTestResults();
    const retryTrs = allTrs.filter((tr) => !!tr?.retries?.length);
    const flakyTrs = allTrs.filter((tr) => !!tr?.flaky);
    const duration = allTrs.reduce((acc, { duration: trDuration = 0 }) => acc + trDuration, 0);
    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));
    const createdAt = allTrs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);

    return {
      name: this.#launchName,
      remoteHref: this.#client.launchUrl,
      stats: await store.testsStatistic(this.options.filter),
      status: worstStatus ?? "passed",
      duration,
      createdAt,
      plugin: "Awesome",
      newTests: newTrs.map(convertToSummaryTestResult),
      flakyTests: flakyTrs.map(convertToSummaryTestResult),
      retryTests: retryTrs.map(convertToSummaryTestResult),
      meta: {
        reportId: context.reportUuid,
      },
    };
  }
}
