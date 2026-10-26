import type { EnvironmentItem } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  createPluginSummary,
} from "@allurereport/plugin-api";
import { preciseTreeLabels } from "@allurereport/plugin-api";
import { generateAttachmentsFiles, generateHistoryDataPoints } from "@allurereport/plugin-api/internal/report";

import { resolveClassicCategories } from "./categories.js";
import { generateTimeline } from "./generateTimeline.js";
import {
  generateAllCharts,
  generateEnvironmentJson,
  generatePieChart,
  generateStaticFiles,
  generateStatistic,
  generateTestResults,
  generateTree,
  generateTreeByCategories,
} from "./generators.js";
import type { ClassicCategory, ClassicPluginOptions } from "./model.js";
import { collectOverviewOptions } from "./overview.js";
import { type ClassicDataWriter, InMemoryReportDataWriter, ReportFileDataWriter } from "./writer.js";

export class ClassicPlugin implements Plugin {
  #writer: ClassicDataWriter | undefined;

  constructor(readonly options: ClassicPluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    const { singleFile, groupBy = [], filter } = this.options ?? {};
    const environmentItems = await store.metadataByKey<EnvironmentItem[]>("allure_environment");
    const statistic = await store.testsStatistic(filter);
    const attachments = await store.allAttachments();

    await generateStatistic(this.#writer!, statistic);
    await generatePieChart(this.#writer!, statistic);
    await generateAllCharts(this.#writer!, store, this.options, context);

    const legacyCategories = await store.metadataByKey<ClassicCategory[]>("allure2_categories");
    const categories = resolveClassicCategories(context.categories, legacyCategories ?? []);
    const convertedTrs = await generateTestResults(this.#writer!, store, { filter, categories });

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
    await generateTree(this.#writer!, "tree", treeLabels, convertedTrs);
    await generateTree(this.#writer!, "behaviors", behaviorLabels, convertedTrs);
    await generateTree(this.#writer!, "packages", packagesLabels, convertedTrs);
    await generateHistoryDataPoints(this.#writer!, store);
    await generateTimeline(this.#writer!, await store.allTestResults({ includeRetries: true, filter }), this.options);

    await generateEnvironmentJson(this.#writer!, environmentItems ?? []);

    if (attachments?.length) {
      await generateAttachmentsFiles(this.#writer!, attachments, (id) => store.attachmentContentById(id));
    }

    const overviewOptions = await collectOverviewOptions(context, store, convertedTrs);
    const reportDataFiles = singleFile ? (this.#writer! as InMemoryReportDataWriter).reportFiles() : [];

    await generateStaticFiles({
      ...this.options,
      allureVersion: context.allureVersion,
      reportFiles: context.reportFiles,
      reportDataFiles,
      reportUuid: context.reportUuid,
      reportName: context.reportName,
      overviewHref: context.overviewHref,
      ...overviewOptions,
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

  async info(context: PluginContext, store: AllureStore): Promise<PluginSummary> {
    return createPluginSummary({
      name: this.options.reportName || context.reportName,
      plugin: "Classic",
      meta: {
        reportId: context.reportUuid,
        singleFile: this.options.singleFile ?? false,
        withTestResultsLinks: true,
      },
      filter: this.options.filter,
      history: context.history,
      ci: context.ci,
      store,
    });
  }
}
