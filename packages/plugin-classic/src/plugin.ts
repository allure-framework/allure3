import type { EnvironmentItem } from "@allurereport/core-api";
import { getWorstStatus } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext, PluginInfo } from "@allurereport/plugin-api";
import { preciseTreeLabels } from "@allurereport/plugin-api";
import {
  generateAttachmentsFiles,
  generateEnvironmentJson,
  generateHistoryDataPoints,
  generatePieChart,
  generateStaticFiles,
  generateStatistic,
  generateTestResults,
  generateTree,
  generateTreeByCategories,
} from "./generators.js";
import type { AwesomePluginOptions } from "./model.js";
import { type AwesomeDataWriter, InMemoryReportDataWriter, ReportFileDataWriter } from "./writer.js";

export class AwesomePlugin implements Plugin {
  #writer: AwesomeDataWriter | undefined;

  constructor(readonly options: AwesomePluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    const { singleFile, groupBy = [] } = this.options ?? {};
    const environmentItems = await store.metadataByKey<EnvironmentItem[]>("allure_environment");
    const statistic = await store.testsStatistic();
    const attachments = await store.allAttachments();

    await generateStatistic(this.#writer!, statistic);
    await generatePieChart(this.#writer!, statistic);

    const convertedTrs = await generateTestResults(this.#writer!, store);

    const treeLabels = preciseTreeLabels(
      !groupBy.length ? ["parentSuite", "suite", "subSuite"] : groupBy,
      convertedTrs,
      ({ labels }) => labels.map(({ name }) => name),
    );
    const behaviorLabels = preciseTreeLabels(
      !groupBy.length ? ["epic", "feature", "story"] : groupBy,
      convertedTrs,
      ({ labels }) => labels.map(({ name }) => name),
    );
    const packagesLabels = preciseTreeLabels(!groupBy.length ? ["package"] : groupBy, convertedTrs, ({ labels }) =>
      labels.map(({ name }) => name),
    );

    await generateTreeByCategories(this.#writer!, "categories", convertedTrs);
    // await generateCategoriesData(this.#writer!, treeLabels, convertedTrs);
    await generateTree(this.#writer!, "tree", treeLabels, convertedTrs);
    await generateTree(this.#writer!, "behaviors", behaviorLabels, convertedTrs);
    await generateTree(this.#writer!, "packages", packagesLabels, convertedTrs);
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

  async info(context: PluginContext, store: AllureStore): Promise<PluginInfo> {
    const allTrs = await store.allTestResults();
    const duration = allTrs.reduce((acc, { duration: trDuration = 0 }) => acc + trDuration, 0);
    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));

    return {
      name: this.options.reportName || context.reportName,
      stats: await store.testsStatistic(this.options.filter),
      status: worstStatus ?? "passed",
      duration,
    };
  }
}
