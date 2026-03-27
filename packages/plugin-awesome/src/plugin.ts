import { incrementStatistic, type EnvironmentItem, type Statistic, joinPosixPath } from "@allurereport/core-api";
import {
  type AllureStore,
  type Plugin,
  type PluginContext,
  type PluginSummary,
  createPluginSummary,
} from "@allurereport/plugin-api";
import { preciseTreeLabels } from "@allurereport/plugin-api";

import { applyCategoriesToTestResults, generateCategories } from "./categories.js";
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

const statisticByTestResults = async (
  store: AllureStore,
  testResults: Awaited<ReturnType<AllureStore["allTestResults"]>>,
): Promise<Statistic> => {
  const statistic: Statistic = { total: 0 };

  for (const testResult of testResults) {
    if (testResult.hidden) {
      continue;
    }

    statistic.total++;
    incrementStatistic(statistic, testResult.status);

    if ((await store.retriesByTrId(testResult.id)).length > 0) {
      statistic.retries = (statistic.retries ?? 0) + 1;
    }

    if (testResult.flaky) {
      statistic.flaky = (statistic.flaky ?? 0) + 1;
    }

    if (testResult.transition === "new") {
      statistic.new = (statistic.new ?? 0) + 1;
    }
  }

  return statistic;
};

export class AwesomePlugin implements Plugin {
  #writer: AwesomeDataWriter | undefined;

  constructor(readonly options: AwesomePluginOptions = {}) {}

  #generate = async (context: PluginContext, store: AllureStore) => {
    const { singleFile, groupBy = [], filter, appendTitlePath } = this.options ?? {};
    const hideLabels = context.hideLabels;
    const categories = context.categories ?? [];
    const environmentItems = await store.metadataByKey<EnvironmentItem[]>("allure_environment");
    const attachments = await store.allAttachments();
    const allTrs = await store.allTestResults({ includeHidden: true, filter });
    const statistics = await store.testsStatistic(filter);
    const environments = await store.allEnvironmentIdentities();
    const envStatistics = new Map<string, Statistic>();
    const allTestEnvGroups = await store.allTestEnvGroups();
    const globalAttachments = await store.allGlobalAttachments();
    const globalExitCode = await store.globalExitCode();
    const globalErrors = await store.allGlobalErrors();
    const qualityGateResults = await store.qualityGateResultsByEnvironmentId();
    const envResultsById = new Map<string, Awaited<ReturnType<AllureStore["allTestResults"]>>>();
    const envIdByTrId = new Map<string, string>();

    environments.forEach(({ id }) => {
      envResultsById.set(id, []);
    });

    await Promise.all(
      allTrs.map(async (tr) => {
        const environmentId = await store.environmentIdByTrId(tr.id);

        if (!environmentId) {
          return;
        }

        envIdByTrId.set(tr.id, environmentId);

        if (!envResultsById.has(environmentId)) {
          envResultsById.set(environmentId, []);
        }

        envResultsById.get(environmentId)!.push(tr);
      }),
    );

    await Promise.all(
      environments.map(async ({ id }) => {
        envStatistics.set(id, await statisticByTestResults(store, envResultsById.get(id) ?? []));
      }),
    );

    await generateStatistic(this.#writer!, {
      stats: statistics,
      statsByEnv: envStatistics,
      envs: environments,
    });
    await generateAllCharts(this.#writer!, store, this.options, context);

    const convertedTrs = await generateTestResults(this.#writer!, store, allTrs, { hideLabels });

    applyCategoriesToTestResults(convertedTrs, categories);
    await generateCategories(this.#writer!, {
      tests: convertedTrs,
      categories,
      environmentCount: environments.length,
      environments: environments.map(({ name }) => name),
      defaultEnvironment: "default",
      selectedEnvironmentCount: environments.length,
    });
    const hasGroupBy = groupBy.length > 0;

    await generateTimeline(this.#writer!, allTrs, this.options, envIdByTrId);

    const treeLabels = hasGroupBy
      ? preciseTreeLabels(groupBy, convertedTrs, ({ labels }) => labels.map(({ name }) => name))
      : [];

    await generateHistoryDataPoints(this.#writer!, store);
    await generateTestCases(this.#writer!, convertedTrs);
    await generateTree(this.#writer!, "tree.json", treeLabels, convertedTrs, { appendTitlePath });
    await generateNav(this.#writer!, convertedTrs, "nav.json");
    await generateTestEnvGroups(this.#writer!, allTestEnvGroups);

    const envConvertedTrsById = new Map<string, typeof convertedTrs>();

    convertedTrs.forEach((tr) => {
      const environmentId = envIdByTrId.get(tr.id);

      if (!environmentId) {
        return;
      }

      if (!envConvertedTrsById.has(environmentId)) {
        envConvertedTrsById.set(environmentId, []);
      }

      envConvertedTrsById.get(environmentId)!.push(tr);
    });

    for (const reportEnvironment of environments) {
      const envConvertedTrs = envConvertedTrsById.get(reportEnvironment.id) ?? [];

      await generateTree(this.#writer!, joinPosixPath(reportEnvironment.id, "tree.json"), treeLabels, envConvertedTrs, {
        appendTitlePath,
      });
      await generateNav(this.#writer!, envConvertedTrs, joinPosixPath(reportEnvironment.id, "nav.json"));
      await generateCategories(this.#writer!, {
        tests: envConvertedTrs,
        categories,
        environmentCount: 1,
        defaultEnvironment: "default",
        selectedEnvironmentCount: 1,
        filename: joinPosixPath(reportEnvironment.id, "categories.json"),
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
