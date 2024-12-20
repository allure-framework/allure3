import { type EnvironmentItem, findByLabelName } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";
import {
  generateAttachmentsFiles,
  generateEnvironmentJson,
  generateHistoryDataPoints,
  generatePieChart,
  generateStaticFiles,
  generateStatistic,
  generateTestResults,
  generateTree,
} from "./generators.js";
import type { AllureAwesomePluginOptions } from "./model.js";
import { type AllureAwesomeDataWriter, InMemoryReportDataWriter, ReportFileDataWriter } from "./writer.js";

export class AllureAwesomePlugin implements Plugin {
  #writer: AllureAwesomeDataWriter | undefined;

  constructor(readonly options: AllureAwesomePluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    const { singleFile, groupBy } = this.options ?? {};
    const environmentItems = await store.metadataByKey<EnvironmentItem[]>("allure_environment");
    const statistic = await store.testsStatistic();
    const allTr = await store.allTestResults({ includeHidden: true });
    const attachments = await store.allAttachments();

    await generateStatistic(this.#writer!, statistic);
    await generatePieChart(this.#writer!, statistic);
    await generateTree(
      this.#writer!,
      "tree",
      groupBy?.length ? groupBy : ["parentSuite", "suite", "subSuite"],
      allTr,
    );

    await generateTestResults(this.#writer!, store);
    await generateHistoryDataPoints(this.#writer!, store);

    if (environmentItems?.length) {
      await generateEnvironmentJson(this.#writer!, environmentItems);
    }

    if (attachments?.length) {
      await generateAttachmentsFiles(this.#writer!, attachments, (id) => store.attachmentContentById(id));
    }

    const reportDataFiles = singleFile ? (this.#writer! as InMemoryReportDataWriter).reportFiles() : [];

    await generateStaticFiles({
      ...this.options,
      allureVersion: context.allureVersion,
      reportFiles: context.reportFiles,
      reportDataFiles,
      reportUuid: context.reportUuid,
      reportName: context.reportName,
    });
  };

  start = async (context: PluginContext) => {
    const { singleFile } = this.options;

    if (singleFile) {
      this.#writer = new InMemoryReportDataWriter();
      return;
    }

    this.#writer = new ReportFileDataWriter(context.reportFiles);

    await Promise.resolve();
  };

  update = async (context: PluginContext, store: AllureStore) => {
    if (!this.#writer) {
      throw new Error("call start first");
    }

    await this.#generate(context, store);
  };

  done = async (context: PluginContext, store: AllureStore) => {
    if (!this.#writer) {
      throw new Error("call start first");
    }

    await this.#generate(context, store);
  };
}
