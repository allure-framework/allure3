import {
  incrementStatistic,
  type EnvironmentItem,
  type Statistic,
  type TestResult,
  joinPosixPath,
} from "@allurereport/core-api";
import {
  type AllureStore,
  type ReportExecutorInfo,
  type ReportRunSummary,
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
  generateMetricsWidget,
  generateNav,
  generateQualityGateResults,
  generateResolutionCategories,
  generateSearchIndex,
  generateStaticFiles,
  generateStatistic,
  generateTestCases,
  generateTestEnvGroups,
  generateTestResults,
  generateTree,
  generateTreeFilters,
  generateVariables,
  getRunSummary,
} from "./generators.js";
import type { AwesomePluginOptions } from "./model.js";
import { type AwesomeDataWriter, InMemoryReportDataWriter, ReportFileDataWriter } from "./writer.js";

const statisticByTestResults = async (
  store: AllureStore,
  testResults: Awaited<ReturnType<AllureStore["allTestResults"]>>,
): Promise<Statistic> => {
  const statistic: Statistic = { total: 0 };
  const related = await store.relatedByTestResultIds(testResults.map(({ id }) => id));
  const incrementResolution = (testResult: (typeof testResults)[number]) => {
    if (testResult.resolution === "issue") {
      statistic.resolutions ??= {};
      statistic.resolutions.issues = (statistic.resolutions.issues ?? 0) + 1;
    }

    if (testResult.resolution === "muted") {
      statistic.resolutions ??= {};
      statistic.resolutions.muted = (statistic.resolutions.muted ?? 0) + 1;
    }

    if (testResult.resolution === "accepted") {
      statistic.resolutions ??= {};
      statistic.resolutions.accepted = (statistic.resolutions.accepted ?? 0) + 1;
    }
  };

  for (const testResult of testResults) {
    if (testResult.isRetry) {
      continue;
    }

    incrementStatistic(statistic, testResult.status);

    if ((related.retriesByTrId.get(testResult.id)?.length ?? 0) > 0) {
      statistic.retries = (statistic.retries ?? 0) + 1;
    }

    if (testResult.flaky) {
      statistic.flaky = (statistic.flaky ?? 0) + 1;
    }

    if (testResult.transition === "new") {
      statistic.new = (statistic.new ?? 0) + 1;
    }

    incrementResolution(testResult);
  }

  return statistic;
};

const isActiveStatisticTestResult = (testResult: TestResult) =>
  testResult.resolution !== "muted" && testResult.resolution !== "accepted";

type PluginPerformance = {
  measure<T>(name: string, fn: () => Promise<T>): Promise<T>;
  count(
    name: string,
    value?: number,
    metadata?: { title: string; unit: string; group: string; groupTitle: string; better: "neutral" },
  ): void;
};

type PerfAwarePluginContext = PluginContext & {
  perf?: PluginPerformance;
};

export class AwesomePlugin implements Plugin {
  #writer: AwesomeDataWriter | undefined;

  constructor(readonly options: AwesomePluginOptions = {}) {}

  #generateAfterStart = async (context: PluginContext, store: AllureStore) => {
    if (!this.#writer) {
      throw new Error("call start first");
    }

    await this.#generate(context, store);
  };

  #generate = async (context: PluginContext, store: AllureStore) => {
    const { singleFile, groupBy = [], filter, appendTitlePath } = this.options ?? {};
    const perf = (context as PerfAwarePluginContext).perf;
    const measure = <T>(name: string, fn: () => Promise<T>) => perf?.measure(name, fn) ?? fn();
    const hideLabels = context.hideLabels;
    const categories = context.categories ?? [];
    const {
      environmentItems,
      executor,
      attachments,
      allTrs,
      runSummary,
      statistics,
      environments,
      allTestEnvGroups,
      globalAttachments,
      globalAttachmentsByEnv,
      globalExitCode,
      globalErrors,
      globalErrorsByEnv,
      qualityGateResults,
    } = await measure("readData", async () => {
      const testResults = await store.allTestResults({ includeRetries: true, filter });

      return {
        environmentItems: await store.metadataByKey<EnvironmentItem[]>("allure_environment"),
        executor: await store.metadataByKey<ReportExecutorInfo>("allure2_executor"),
        attachments: await store.allAttachments(),
        allTrs: testResults,
        runSummary: getRunSummary(testResults),
        statistics: await store.testsStatistic(filter),
        environments: await store.allEnvironmentIdentities(),
        allTestEnvGroups: await store.allTestEnvGroups(),
        globalAttachments: await store.allGlobalAttachments(),
        globalAttachmentsByEnv: await store.allGlobalAttachmentsByEnv(),
        globalExitCode: await store.globalExitCode(),
        globalErrors: await store.allGlobalErrors(),
        globalErrorsByEnv: await store.allGlobalErrorsByEnv(),
        qualityGateResults: await store.qualityGateResultsByEnvironmentId(),
      };
    });
    if (perf && attachments.length > 0) {
      perf.count("attachments.count", attachments.length, {
        title: "Attachments",
        unit: "attachments",
        group: "workload",
        groupTitle: "Workload",
        better: "neutral",
      });
      perf.count(
        "attachmentBytes",
        attachments.reduce(
          (total, attachment) => total + ("contentLength" in attachment ? (attachment.contentLength ?? 0) : 0),
          0,
        ),
        {
          title: "Attachment bytes",
          unit: "bytes",
          group: "workload",
          groupTitle: "Workload",
          better: "neutral",
        },
      );
    }
    const envIdByTrId = new Map<string, string>();

    await measure("environmentMap", async () => {
      await Promise.all(
        allTrs.map(async (tr) => {
          const environmentId = await store.environmentIdByTrId(tr.id);

          if (!environmentId) {
            return;
          }

          envIdByTrId.set(tr.id, environmentId);
        }),
      );
    });

    const trsByEnvId = new Map<string, typeof allTrs>();

    await measure("stats", async () => {
      const envStatistics = new Map<string, Statistic>();
      const pieStatistics = await statisticByTestResults(store, allTrs.filter(isActiveStatisticTestResult));
      const pieEnvStatistics = new Map<string, Statistic>();

      for (const tr of allTrs) {
        const environmentId = envIdByTrId.get(tr.id);

        if (!environmentId) {
          continue;
        }

        const group = trsByEnvId.get(environmentId);

        if (group) {
          group.push(tr);
        } else {
          trsByEnvId.set(environmentId, [tr]);
        }
      }

      await Promise.all(
        environments.map(async ({ id }) => {
          const envTrs = trsByEnvId.get(id) ?? [];

          envStatistics.set(id, await statisticByTestResults(store, envTrs));
          pieEnvStatistics.set(id, await statisticByTestResults(store, envTrs.filter(isActiveStatisticTestResult)));
        }),
      );

      await generateStatistic(this.#writer!, {
        stats: statistics,
        statsByEnv: envStatistics,
        pieStats: pieStatistics,
        pieStatsByEnv: pieEnvStatistics,
        envs: environments,
      });
    });
    const runSummaryByEnv: Record<string, ReportRunSummary> = {};

    for (const { id } of environments) {
      const envRunSummary = getRunSummary(trsByEnvId.get(id) ?? []);

      if (envRunSummary) {
        runSummaryByEnv[id] = envRunSummary;
      }
    }
    await measure("charts", () => generateAllCharts(this.#writer!, store, this.options, context));
    const hasMetrics = await generateMetricsWidget(this.#writer!, store, context.reportUuid);

    const convertedTrs = await measure("convert", () =>
      generateTestResults(this.#writer!, store, allTrs, { hideLabels }),
    );
    if (perf) {
      perf.count("convertedTestResults.count", convertedTrs.length, {
        title: "Converted test results",
        unit: "test results",
        group: "workload",
        groupTitle: "Workload",
        better: "neutral",
      });
    }

    await measure("categories", async () => {
      applyCategoriesToTestResults(convertedTrs, categories);
      await generateCategories(this.#writer!, {
        tests: convertedTrs,
        categories,
        environmentCount: environments.length,
        environments: environments.map(({ name }) => name),
        defaultEnvironment: "default",
        selectedEnvironmentCount: environments.length,
      });
      await generateResolutionCategories(this.#writer!, convertedTrs);
    });
    const hasGroupBy = groupBy.length > 0;

    await measure("timeline", () => generateTimeline(this.#writer!, allTrs, this.options, envIdByTrId));

    const treeLabels = hasGroupBy
      ? preciseTreeLabels(groupBy, convertedTrs, ({ labels }) => labels.map(({ name }) => name))
      : [];

    await generateHistoryDataPoints(this.#writer!, store);
    await measure("testCases", () => generateTestCases(this.#writer!, convertedTrs));
    await measure("tree", () =>
      generateTree(this.#writer!, "tree.json", treeLabels, convertedTrs, { appendTitlePath }),
    );
    await measure("nav", () => generateNav(this.#writer!, convertedTrs, "nav.json"));
    await measure("searchIndex", () => generateSearchIndex(this.#writer!, convertedTrs, "search-index.json"));
    await measure("testEnvGroups", () => generateTestEnvGroups(this.#writer!, allTestEnvGroups));

    const convertedTrsById = new Map(convertedTrs.map((tr) => [tr.id, tr] as const));

    await measure("environmentsOutput", async () => {
      for (const reportEnvironment of environments) {
        const envTrs = await store.testResultsByEnvironmentId(reportEnvironment.id, { includeRetries: true });
        const envConvertedTrs = envTrs
          .map((tr) => convertedTrsById.get(tr.id))
          .filter((tr): tr is (typeof convertedTrs)[number] => Boolean(tr));

        await generateTree(
          this.#writer!,
          joinPosixPath(reportEnvironment.id, "tree.json"),
          treeLabels,
          envConvertedTrs,
          {
            appendTitlePath,
          },
        );
        await generateNav(this.#writer!, envConvertedTrs, joinPosixPath(reportEnvironment.id, "nav.json"));
        await generateSearchIndex(
          this.#writer!,
          envConvertedTrs,
          joinPosixPath(reportEnvironment.id, "search-index.json"),
        );
        await generateCategories(this.#writer!, {
          tests: envConvertedTrs,
          categories,
          environmentCount: 1,
          defaultEnvironment: "default",
          selectedEnvironmentCount: 1,
          filename: joinPosixPath(reportEnvironment.id, "categories.json"),
        });
        await generateResolutionCategories(
          this.#writer!,
          envConvertedTrs,
          joinPosixPath(reportEnvironment.id, "resolution-categories.json"),
        );
      }
    });

    await generateTreeFilters(this.#writer!, convertedTrs);

    await generateEnvirontmentsList(this.#writer!, store);
    await generateVariables(this.#writer!, store);

    await generateEnvironmentJson(this.#writer!, environmentItems ?? []);

    if (attachments?.length) {
      await measure("attachments", () =>
        generateAttachmentsFiles(this.#writer!, attachments, (id) => store.attachmentContentById(id)),
      );
    }

    await generateQualityGateResults(this.#writer!, qualityGateResults, {
      tests: convertedTrs,
      labels: treeLabels,
      appendTitlePath,
    });
    await measure("globals", () =>
      generateGlobals(this.#writer!, {
        globalAttachments,
        globalAttachmentsByEnv,
        globalErrors,
        globalErrorsByEnv,
        globalExitCode,
        contentFunction: (id) => store.attachmentContentById(id),
      }),
    );

    const reportDataFiles = !singleFile
      ? []
      : perf
        ? await perf.measure("singleFileReportFiles", async () =>
            (this.#writer as InMemoryReportDataWriter).reportFiles(),
          )
        : (this.#writer as InMemoryReportDataWriter).reportFiles();

    const configuredSections = this.options.sections ?? ["charts", "timeline"];
    const sections = hasMetrics
      ? [...new Set([...configuredSections, "metrics"])]
      : configuredSections.filter((section) => section !== "metrics");

    await measure("staticFiles", () =>
      generateStaticFiles({
        ...this.options,
        sections,
        id: context.id,
        allureVersion: context.allureVersion,
        reportFiles: context.reportFiles,
        reportUuid: context.reportUuid,
        reportName: context.reportName,
        ci: context.ci,
        executor,
        runSummary,
        runSummaryByEnv,
        reportDataFiles,
      }),
    );
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
    await this.#generateAfterStart(context, store);
  };

  done = async (context: PluginContext, store: AllureStore) => {
    await this.#generateAfterStart(context, store);
  };

  async info(context: PluginContext, store: AllureStore): Promise<PluginSummary> {
    const perf = (context as PerfAwarePluginContext).perf;
    const create = () =>
      createPluginSummary({
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

    return perf?.measure("summary.create", create) ?? create();
  }
}
