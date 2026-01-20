import { type AllureStore, type Plugin, type PluginContext } from "@allurereport/plugin-api";
import { TestOpsClient } from "./client.js";
import type { TestopsUploaderPluginOptions } from "./model.js";
import { unwrapStepsAttachments } from "./utils.js";

export class TestopsUploaderPlugin implements Plugin {
  #client: TestOpsClient;

  constructor(readonly options: TestopsUploaderPluginOptions) {
    if (!options.accessToken) {
      throw new Error("Allure3 TestOps plugin: accessToken is required");
    }

    if (!options.endpoint) {
      throw new Error("Allure3 TestOps plugin: endpoint is required");
    }

    if (!options.projectId) {
      throw new Error("Allure3 TestOps plugin: projectId is required");
    }

    this.#client = new TestOpsClient({
      baseUrl: this.options.endpoint,
      accessToken: this.options.accessToken,
      projectId: this.options.projectId,
    });
  }

  done = async (context: PluginContext, store: AllureStore) => {
    await this.#client.initialize(`Allure Report run: "${context.reportName}"`);

    const allTrs = await store.allTestResults();
    const allTrsWithAttachments = allTrs.map((tr) => {
      return {
        ...tr,
        steps: unwrapStepsAttachments(tr.steps),
      };
    });

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
              // sending attachment content as stream
              content: await content?.readContent(async (s) => s),
              // content: await content?.asBuffer(),
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

    // eslint-disable-next-line no-console
    console.info(`TestOps launch has been created: ${this.#client.launchUrl}`);
  };
}
