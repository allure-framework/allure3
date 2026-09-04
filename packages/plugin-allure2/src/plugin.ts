import type { EnvironmentItem } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  createPluginSummary,
  preciseTreeLabels,
} from "@allurereport/plugin-api";

import { convertTestResult } from "./converters.js";
import {
  generateAttachmentsData,
  generateCategoriesData,
  generateCategoriesTrendData,
  generateDefaultWidgetData,
  generateDurationTrendData,
  generateEnvironmentJson,
  generateExecutorJson,
  generateGlobalsData,
  generateHistoryTrendData,
  generatePackagesData,
  generateRetryTrendData,
  generateStaticFiles,
  generateSummaryJson,
  generateTestResults,
  generateTimelineData,
  generateTree,
} from "./generators.js";
import type {
  Allure2CategoriesTrendItem,
  Allure2Category,
  Allure2DurationTrendItem,
  Allure2ExecutorInfo,
  Allure2LegacyHistory,
  Allure2LegacyHistoryTrendItem,
  Allure2PluginOptions,
  Allure2RetryTrendItem,
  Allure2TestResult,
} from "./model.js";
import { InMemoryReportDataWriter, ReportFileDataWriter } from "./writer.js";

export class Allure2Plugin implements Plugin {
  constructor(readonly options: Allure2PluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    const { reportName = "Allure Report", singleFile = false, reportLanguage = "en" } = this.options ?? {};
    const writer = singleFile ? new InMemoryReportDataWriter() : new ReportFileDataWriter(context.reportFiles);
    const attachmentLinks = await store.allAttachments();
    const attachmentMap = await generateAttachmentsData(writer, attachmentLinks, (id) =>
      store.attachmentContentById(id),
    );
    const [globalErrors, globalAttachments] = await Promise.all([
      store.allGlobalErrors(),
      store.allGlobalAttachments(),
    ]);
    const globalAttachmentTimestamps =
      (await store.metadataByKey<Record<string, number>>("allure2_global_attachment_timestamps")) ?? {};
    const globalErrorTimestamps =
      (await store.metadataByKey<Array<number | undefined>>("allure2_global_error_timestamps")) ?? [];

    await generateGlobalsData(
      writer,
      globalErrors,
      globalAttachments,
      attachmentMap,
      globalAttachmentTimestamps,
      globalErrorTimestamps,
    );

    const categories = (await store.metadataByKey<Allure2Category[]>("allure2_categories")) ?? [];
    const legacyHistory = (await store.metadataByKey<Allure2LegacyHistory>("allure2_history")) ?? {};
    const environmentItems = (await store.metadataByKey<EnvironmentItem[]>("allure_environment")) ?? [];
    const tests = await store.allTestResults({ includeRetries: true });
    const related = await store.relatedByTestResultIds(tests.map(({ id }) => id));
    const allTr: Allure2TestResult[] = [];

    for (const value of tests) {
      const fixtures = related.fixturesByTrId.get(value.id) ?? [];
      const retries = related.retriesByTrId.get(value.id) ?? [];
      const history = related.historyByTrId.get(value.id) ?? [];
      const allure2TestResult = convertTestResult(
        {
          attachmentMap,
          fixtures,
          categories,
          retries,
          history,
          legacyHistory: value.historyId ? legacyHistory[value.historyId] : undefined,
        },
        value,
      );

      allTr.push(allure2TestResult);
    }

    await generateTestResults(writer, allTr);

    const displayedTr = allTr.filter((atr) => !atr.isRetry);
    const treeLabelNamesFactory = (labelNames: string[]) =>
      preciseTreeLabels(labelNames, displayedTr, (tr) => {
        if (tr.labels) {
          return tr.labels.map(({ name }) => name!);
        }

        return [] as string[];
      });

    await generateTree(writer, "suites", treeLabelNamesFactory(["parentSuite", "suite", "subSuite"]), displayedTr);
    await generateTree(writer, "behaviors", treeLabelNamesFactory(["epic", "feature", "story"]), displayedTr);
    await generatePackagesData(writer, displayedTr);
    await generateCategoriesData(writer, displayedTr);
    await generateTimelineData(writer, allTr);
    await generateSummaryJson(writer, reportName, displayedTr);
    await generateEnvironmentJson(writer, environmentItems);

    const executor = await store.metadataByKey<Partial<Allure2ExecutorInfo>>("allure2_executor");
    const historyDataPoints = await store.allHistoryDataPoints();
    const historyTrend = (await store.metadataByKey<Allure2LegacyHistoryTrendItem[]>("allure2_history_trend")) ?? [];
    const durationTrend = (await store.metadataByKey<Allure2DurationTrendItem[]>("allure2_duration_trend")) ?? [];
    const retryTrend = (await store.metadataByKey<Allure2RetryTrendItem[]>("allure2_retry_trend")) ?? [];
    const categoriesTrend = (await store.metadataByKey<Allure2CategoriesTrendItem[]>("allure2_categories_trend")) ?? [];

    await generateExecutorJson(writer, executor);
    await generateDefaultWidgetData(writer, displayedTr, "duration.json", "status-chart.json", "severity.json");
    await generateHistoryTrendData(writer, reportName, displayedTr, historyDataPoints, historyTrend, executor);
    await generateDurationTrendData(writer, displayedTr, durationTrend, executor);
    await generateRetryTrendData(writer, allTr, retryTrend, executor);
    await generateCategoriesTrendData(writer, allTr, categoriesTrend, executor);

    const reportDataFiles = singleFile ? (writer as InMemoryReportDataWriter).reportFiles() : [];

    await generateStaticFiles({
      allureVersion: context.allureVersion,
      reportName,
      reportLanguage,
      singleFile,
      reportFiles: context.reportFiles,
      reportDataFiles,
      reportUuid: context.reportUuid,
    });
  };

  async info(context: PluginContext, store: AllureStore): Promise<PluginSummary> {
    return createPluginSummary({
      name: this.options.reportName || context.reportName,
      plugin: "Allure2",
      meta: {
        reportId: context.reportUuid,
        singleFile: this.options.singleFile ?? false,
        withTestResultsLinks: true,
      },
      history: context.history,
      ci: context.ci,
      store,
    });
  }

  update = async (context: PluginContext, store: AllureStore) => {
    await this.#generate(context, store);
  };

  done = async (context: PluginContext, store: AllureStore) => {
    await this.update(context, store);
  };
}
