import { type EnvironmentItem, type Statistic } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  createPluginSummary,
} from "@allurereport/plugin-api";
import { preciseTreeLabels } from "@allurereport/plugin-api";
import { join } from "node:path";
import { applyCategoriesToTestResults, generateCategories } from "./categories.js";
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
    const categories = context.categories ?? [];
    const environmentItems = await store.metadataByKey<EnvironmentItem[]>("allure_environment");
    const reportEnvironments = await store.allEnvironments();
    const attachments = await store.allAttachments();
    const allTrs = await store.allTestResults({ includeHidden: true, filter });
    const statistics = await store.testsStatistic(filter);
    const environments = await store.allEnvironments();
    const envStatistics = new Map<string, Statistic>();
    const allTestEnvGroups = await store.allTestEnvGroups();
    const globalAttachments = await store.allGlobalAttachments();
    const globalExitCode = await store.globalExitCode();
    const globalErrors = await store.allGlobalErrors();
    const qualityGateResults = await store.qualityGateResultsByEnv();

    for (const env of environments) {
      envStatistics.set(env, await store.testsStatistic(filterEnv(env, filter)));
    }

    await generateStatistic(this.#writer!, {
      stats: statistics,
      statsByEnv: envStatistics,
      envs: environments,
    });
    await generateAllCharts(this.#writer!, store, this.options, context);

    const convertedTrs = await generateTestResults(this.#writer!, store, allTrs);

    applyCategoriesToTestResults(convertedTrs, categories);
    await generateCategories(this.#writer!, {
      tests: convertedTrs,
      categories,
      environmentCount: environments.length,
      environments,
      defaultEnvironment: "default",
      selectedEnvironmentCount: environments.length,
    });
    const hasGroupBy = groupBy.length > 0;

    await generateTimeline(this.#writer!, convertedTrs, this.options);

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

      await generateCategories(this.#writer!, {
        tests: envConvertedTrs,
        categories,
        environmentCount: 1,
        defaultEnvironment: "default",
        selectedEnvironmentCount: 1,
        filename: join(reportEnvironment, "categories.json"),
      });
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
    return createPluginSummary({
      name: this.options.reportName || context.reportName,
      plugin: "Awesome",
      meta: {
        reportId: context.reportUuid,
        singleFile: this.options.singleFile ?? false,
        withTestResultsLinks: true,
      },
      filter: this.options.filter,
      ci: context.ci,
      history: context.history,
      store,
    });
  }
}
