import { type EnvironmentItem, type Statistic, getWorstStatus } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  convertToSummaryTestResult,
} from "@allurereport/plugin-api";
import { preciseTreeLabels } from "@allurereport/plugin-api";
import { join } from "node:path";
import { filterEnv } from "./environments.js";
import { generateTimeline } from "./generateTimeline.js";
import {
  generateAllCharts,
  generateAttachmentsFiles,
  generateEnvironmentJson,
  generateEnvirontmentsList,
  generateGlobals,
  generateHistoryDataPoints,
  generateNav,
  generateQualityGateResults,
  generateStaticFiles,
  generateStatistic,
  generateTestCases,
  generateTestEnvGroups,
  generateTestResults,
  generateTree,
  generateTreeFilters,
  generateVariables,
} from "./generators.js";
import type { AwesomePluginOptions } from "./model.js";
import { type AwesomeDataWriter, InMemoryReportDataWriter, ReportFileDataWriter } from "./writer.js";

export class AwesomePlugin implements Plugin {
  #writer: AwesomeDataWriter | undefined;

  constructor(readonly options: AwesomePluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    const { singleFile, groupBy = [], filter, appendTitlePath } = this.options ?? {};
    const environmentItems = await store.metadataByKey<EnvironmentItem[]>("allure_environment");
    const reportEnvironments = await store.allEnvironments();
    const attachments = await store.allAttachments();
    const allTrs = await store.allTestResults({ includeHidden: true });
    const statistics = await store.testsStatistic(filter);
    const environments = await store.allEnvironments();
    const envStatistics = new Map<string, Statistic>();
    const allTestEnvGroups = await store.allTestEnvGroups();
    const globalAttachments = await store.allGlobalAttachments();
    const globalExitCode = await store.globalExitCode();
    const globalErrors = await store.allGlobalErrors();
    const qualityGateResults = await store.qualityGateResults();

    for (const env of environments) {
      envStatistics.set(env, await store.testsStatistic(filterEnv(env, filter)));
    }

    await generateStatistic(this.#writer!, {
      stats: statistics,
      statsByEnv: envStatistics,
      envs: environments,
    });
    await generateAllCharts(this.#writer!, store, this.options, context);

    await generateTimeline(this.#writer!, store, this.options);

    const convertedTrs = await generateTestResults(this.#writer!, store, allTrs, this.options.filter);
    const hasGroupBy = groupBy.length > 0;

    const treeLabels = hasGroupBy
      ? preciseTreeLabels(groupBy, convertedTrs, ({ labels }) => labels.map(({ name }) => name))
      : [];

    await generateHistoryDataPoints(this.#writer!, store);
    await generateTestCases(this.#writer!, convertedTrs);
    await generateTree(this.#writer!, "tree.json", treeLabels, convertedTrs, { appendTitlePath });
    await generateNav(this.#writer!, convertedTrs, "nav.json");
    await generateTestEnvGroups(this.#writer!, allTestEnvGroups);

    for (const reportEnvironment of reportEnvironments) {
      const envConvertedTrs = convertedTrs.filter(({ environment }) => environment === reportEnvironment);

      await generateTree(this.#writer!, join(reportEnvironment, "tree.json"), treeLabels, envConvertedTrs, {
        appendTitlePath,
      });
      await generateNav(this.#writer!, envConvertedTrs, join(reportEnvironment, "nav.json"));
    }

    await generateTreeFilters(this.#writer!, convertedTrs);

    await generateEnvirontmentsList(this.#writer!, store);
    await generateVariables(this.#writer!, store);

    if (environmentItems?.length) {
      await generateEnvironmentJson(this.#writer!, environmentItems);
    }

    if (attachments?.length) {
      await generateAttachmentsFiles(this.#writer!, attachments, (id) => store.attachmentContentById(id));
    }

    await generateQualityGateResults(this.#writer!, qualityGateResults);
    await generateGlobals(this.#writer!, {
      globalAttachments,
      globalErrors,
      globalExitCode,
      contentFunction: (id) => store.attachmentContentById(id),
    });

    const reportDataFiles = singleFile ? (this.#writer! as InMemoryReportDataWriter).reportFiles() : [];

    await generateStaticFiles({
      ...this.options,
      id: context.id,
      allureVersion: context.allureVersion,
      reportFiles: context.reportFiles,
      reportUuid: context.reportUuid,
      reportName: context.reportName,
      ci: context.ci,
      reportDataFiles,
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
      name: this.options.reportName || context.reportName,
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
        singleFile: this.options.singleFile ?? false,
        withTestResultsLinks: true,
      },
    };
  }
}
