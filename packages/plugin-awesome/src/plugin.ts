import { type EnvironmentItem, type Statistic } from "@allurereport/core-api";
import type { AllureStore, Plugin, PluginContext } from "@allurereport/plugin-api";
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
  generateTrendData,
} from "./generators.js";
import type { AllureAwesomePluginOptions } from "./model.js";
import { type AllureAwesomeDataWriter, InMemoryReportDataWriter, ReportFileDataWriter } from "./writer.js";

export class AllureAwesomePlugin implements Plugin {
  #writer: AllureAwesomeDataWriter | undefined;

  constructor(readonly options: AllureAwesomePluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    const { singleFile, groupBy = [] } = this.options ?? {};
    const environmentItems = await store.metadataByKey<EnvironmentItem[]>("allure_environment");
    const statistic = await store.testsStatistic();
    const attachments = await store.allAttachments();
    const historyDataPoints = await store.allHistoryDataPoints();

    await generateStatistic(this.#writer!, statistic);
    await generatePieChart(this.#writer!, statistic);

    const convertedTrs = await generateTestResults(this.#writer!, store);
    const treeLabels = preciseTreeLabels(
      !groupBy.length ? ["parentSuite", "suite", "subSuite"] : groupBy,
      convertedTrs,
      ({ labels }) => labels.map(({ name }) => name),
    );

    await generateTree(this.#writer!, "tree", treeLabels, convertedTrs);
    await generateHistoryDataPoints(this.#writer!, store);

    if (environmentItems?.length) {
      await generateEnvironmentJson(this.#writer!, environmentItems);
    }

    if (attachments?.length) {
      await generateAttachmentsFiles(this.#writer!, attachments, (id) => store.attachmentContentById(id));
    }

    // Trend data generation
    const historyPoints = historyDataPoints.map(point => ({
      name: point.name,
      statistic: Object.values(point.testResults).reduce((stat: Statistic, test) => {
        if (test.status) {
          stat[test.status] = (stat[test.status] || 0) + 1;
          stat.total = (stat.total || 0) + 1;
        }

        return stat;
      }, { total: 0 } as Statistic)
    }));
    await generateTrendData(this.#writer!, context.reportName, statistic, historyPoints);

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
