import { type AllureStore, type Plugin, type PluginContext } from "@allurereport/plugin-api";
import { TestOpsClient } from "./client.js";
import type { TestopsUploaderPluginOptions } from "./model.js";
import { resolvePluginOptions, unwrapStepsAttachments } from "./utils.js";

export class TestopsUploaderPlugin implements Plugin {
  #client: TestOpsClient;
  #uploadedTestResultsIds: string[] = [];

  constructor(readonly options: TestopsUploaderPluginOptions) {
    const { accessToken, endpoint, projectId } = resolvePluginOptions(options);

    this.#client = new TestOpsClient({
      baseUrl: endpoint,
      accessToken,
      projectId,
    });
  }

  async #upload(store: AllureStore, options?: { issueNewToken: boolean }) {
    const { issueNewToken = true } = options ?? {};
    const allTrs = await store.allTestResults();
    const trsToUpload = allTrs.filter((tr) => !this.#uploadedTestResultsIds.includes(tr.id));

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
      await this.#client.issueOauthToken();
    }

    await this.#client.createSession();
    await this.#client.uploadTestResults({
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

  async start(context: PluginContext, store: AllureStore) {
    await this.#client.issueOauthToken();
    await this.#client.createLaunch(this.options.reportName || context.reportName || "Allure Report");
    await this.#upload(store, { issueNewToken: false });

    // eslint-disable-next-line no-console
    console.info(`TestOps launch has been created: ${this.#client.launchUrl}`);
  }

  async update(_context: PluginContext, store: AllureStore) {
    await this.#upload(store);
  }

  async done(_context: PluginContext, store: AllureStore) {
    await this.#upload(store);
  }
}
