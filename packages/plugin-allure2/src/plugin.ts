import type { EnvironmentItem } from "@allurereport/core-api";
import { getWorstStatus } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  convertToSummaryTestResult,
  preciseTreeLabels,
} from "@allurereport/plugin-api";
import { convertTestResult } from "./converters.js";
import {
  generateAttachmentsData,
  generateCategoriesData,
  generateDefaultWidgetData,
  generateEmptyTrendData,
  generateEnvironmentJson,
  generateExecutorJson,
  generatePackagesData,
  generateStaticFiles,
  generateSummaryJson,
  generateTestResults,
  generateTimelineData,
  generateTree,
  generateTrendData,
} from "./generators.js";
import type { Allure2Category, Allure2ExecutorInfo, Allure2PluginOptions, Allure2TestResult } from "./model.js";
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
    const categories = (await store.metadataByKey<Allure2Category[]>("allure2_categories")) ?? [];
    const environmentItems = (await store.metadataByKey<EnvironmentItem[]>("allure_environment")) ?? [];
    const tests = await store.allTestResults({ includeHidden: true });
    const allTr: Allure2TestResult[] = [];

    for (const value of tests) {
      const fixtures = await store.fixturesByTrId(value.id);
      const retries = await store.retriesByTrId(value.id);
      const history = await store.historyByTrId(value.id);
      const allure2TestResult = convertTestResult(
        {
          attachmentMap,
          fixtures,
          categories,
          retries,
          history,
        },
        value,
      );

      allTr.push(allure2TestResult);
    }

    await generateTestResults(writer, allTr);

    const displayedTr = allTr.filter((atr) => !atr.hidden);
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

    await generateExecutorJson(writer, executor);
    await generateDefaultWidgetData(writer, displayedTr, "duration.json", "status-chart.json", "severity.json");
    await generateTrendData(writer, reportName, displayedTr, historyDataPoints);
    await generateEmptyTrendData(writer, "duration-trend.json", "categories-trend.json", "retry-trend.json");

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
    const allTrs = await store.allTestResults();
    const newTrs = await store.allNewTestResults();
    const retryTrs = allTrs.filter((tr) => !!tr?.retries?.length);
    const flakyTrs = allTrs.filter((tr) => !!tr?.flaky);
    const duration = allTrs.reduce((acc, { duration: trDuration = 0 }) => acc + trDuration, 0);
    const worstStatus = getWorstStatus(allTrs.map(({ status }) => status));
    const createdAt = allTrs.reduce((acc, { stop }) => Math.max(acc, stop || 0), 0);

    return {
      reportId: context.reportUuid,
      name: this.options.reportName || context.reportName,
      stats: await store.testsStatistic(),
      status: worstStatus ?? "passed",
      duration,
      createdAt,
      plugin: "Allure2",
      newTests: newTrs.map(convertToSummaryTestResult),
      flakyTests: flakyTrs.map(convertToSummaryTestResult),
      retryTests: retryTrs.map(convertToSummaryTestResult),
      meta: {
        singleFile: this.options.singleFile ?? false,
        withTestResultsLinks: true,
      },
    };
  }

  update = async (context: PluginContext, store: AllureStore) => {
    await this.#generate(context, store);
  };

  done = async (context: PluginContext, store: AllureStore) => {
    await this.update(context, store);
  };
}
