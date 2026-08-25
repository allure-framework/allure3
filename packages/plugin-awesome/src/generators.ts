import { randomUUID } from "node:crypto";

import { defaultChartsConfig } from "@allurereport/charts-api";
import {
  type AttachmentLink,
  type EnvironmentIdentity,
  type EnvironmentItem,
  type MetricSample,
  type Statistic,
  type TestEnvGroup,
  type TestLabel,
  type TestResult,
  type TreeData,
  appLoaderFaviconDataUri,
  appLoaderStyles,
  compareBy,
  createAppLoaderMarkup,
  createBaseUrlScript,
  createFaviconLinkTag,
  createFontLinkTag,
  createReportDataScript,
  stringifyForInlineScript,
  createScriptTag,
  createStylesLinkTag,
  incrementStatistic,
  joinPosixPath,
  nullsLast,
  ordinal,
  resolveMetricSamples,
} from "@allurereport/core-api";
import type {
  AllureStore,
  ReportCategory,
  ReportExecutorInfo,
  ReportFixtureResult,
  ReportOptions,
  ReportRunSummary,
  ReportSearchDocument,
  ReportTestResult,
  ReportTreeGroup,
  ReportTreeLeaf,
  GlobalAttachmentLink,
  ExitCode,
  PluginContext,
  PluginGlobalError,
  PluginGlobals,
  QualityGateValidationResult,
  ReportFiles,
  ResultFile,
} from "@allurereport/plugin-api";
import {
  collapseTreeGroups,
  createTreeByLabels,
  createTreeByLabelsAndTitlePath,
  createTreeByTitlePath,
  preciseTreeLabels,
  processTree,
} from "@allurereport/plugin-api";
import {
  copyReportStaticAssets,
  getReportStaticAsset,
  readReportStaticAssets,
} from "@allurereport/plugin-api/static-assets";
import { generateCharts, getPieChartValues } from "@allurereport/web-commons";
import Handlebars from "handlebars";

import { convertFixtureResult, convertTestResult } from "./converters.js";
import type { AwesomeOptions, TemplateManifest } from "./model.js";
import type { AwesomeDataWriter, ReportFile } from "./writer.js";

const reportStaticArchive = new URL("../dist/static/report.tar", import.meta.url);

const template = `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
    <meta charset="utf-8">
    <title> {{ reportName }} </title>
    ${createFaviconLinkTag(appLoaderFaviconDataUri)}
    ${appLoaderStyles}
    {{{ headTags }}}
    <script>
      window.allureReportOptions = {{{ reportOptions }}}
    </script>
</head>
<body>
    ${createAppLoaderMarkup()}
    <div id="app"></div>
    ${createBaseUrlScript()}
    <script>
      window.allure = window.allure || {};
    </script>
    {{{ bodyTags }}}
    {{#if analyticsEnable}}
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-LNDJ3J7WT0"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-LNDJ3J7WT0', {
          "report": "awesome",
          "allureVersion": "{{ allureVersion }}",
          "reportUuid": "{{ reportUuid }}",
          "single_file": "{{singleFile}}"
        });
    </script>
    {{/if}}
    {{{ reportFilesScript }}}
</body>
</html>
`;

const compiledTemplate = Handlebars.compile(template);

export const readTemplateManifest = async (_singleFileMode?: boolean): Promise<TemplateManifest> => {
  const { manifest } = await readReportStaticAssets(reportStaticArchive);

  return manifest;
};

const createBreadcrumbs = (convertedTr: ReportTestResult) => {
  const labelsByType = convertedTr.labels.reduce(
    (acc: Record<string, string[]>, label: TestLabel) => {
      if (!acc[label.name]) {
        acc[label.name] = [];
      }
      acc[label.name].push(label.value || "");
      return acc;
    },
    {} as Record<string, string[]>,
  );

  const parentSuites: string[] = labelsByType.parentSuite ?? [""];
  const suites: string[] = labelsByType.suite ?? [""];
  const subSuites: string[] = labelsByType.subSuite ?? [""];

  return parentSuites.reduce((acc: string[][], parentSuite: string) => {
    suites.forEach((suite: string) => {
      subSuites.forEach((subSuite: string) => {
        const path = [parentSuite, suite, subSuite].filter(Boolean);
        if (path.length > 0) {
          acc.push(path);
        }
      });
    });
    return acc;
  }, [] as string[][]);
};

const writeConcurrently = async <T>(items: readonly T[], write: (item: T) => Promise<void>, concurrency = 64) => {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(write));
  }
};

export const generateTestResults = async (
  _writer: AwesomeDataWriter,
  store: AllureStore,
  trs: TestResult[],
  options: {
    hideLabels?: readonly (string | RegExp)[];
  } = {},
) => {
  let convertedTrs: ReportTestResult[] = [];
  const related = await store.relatedByTestResultIds(trs.map(({ id }) => id));

  for (const tr of trs) {
    const trFixtures = related.fixturesByTrId.get(tr.id) ?? [];
    const convertedTrFixtures: ReportFixtureResult[] = [...trFixtures]
      .sort(nullsLast(compareBy("start", ordinal())))
      .map(convertFixtureResult);
    const convertedTr: ReportTestResult = convertTestResult(tr, {
      hideLabels: options.hideLabels,
    });

    convertedTr.history = related.historyByTrId.get(tr.id) ?? [];
    convertedTr.retries = related.retriesByTrId.get(tr.id) ?? [];
    convertedTr.retriesCount = convertedTr.retries.length;
    convertedTr.retry = convertedTr.retriesCount > 0;
    convertedTr.isRetry = tr.isRetry;
    convertedTr.setup = convertedTrFixtures.filter((f) => f.type === "before");
    convertedTr.teardown = convertedTrFixtures.filter((f) => f.type === "after");
    // FIXME: the type is correct, but typescript still shows an error
    // @ts-ignore
    convertedTr.attachments = (related.attachmentsByTrId.get(tr.id) ?? []).map((attachment) => ({
      link: attachment,
      type: "attachment",
    }));
    convertedTr.breadcrumbs = createBreadcrumbs(convertedTr);

    convertedTrs.push(convertedTr);
  }

  convertedTrs = convertedTrs.sort(nullsLast(compareBy("start", ordinal()))).map((tr, idx) => ({
    ...tr,
    order: idx + 1,
  }));

  return convertedTrs;
};

export const generateTestCases = async (writer: AwesomeDataWriter, trs: ReportTestResult[]) => {
  await writeConcurrently(trs, (tr) => writer.writeTestCase(tr));
};

export const generateTestEnvGroups = async (writer: AwesomeDataWriter, groups: TestEnvGroup[]) => {
  for (const group of groups) {
    const src = joinPosixPath("test-env-groups", `${group.id}.json`);

    await writer.writeData(src, group);
  }
};

export const generateNav = async (writer: AwesomeDataWriter, trs: ReportTestResult[], filename = "nav.json") => {
  await writer.writeWidget(
    filename,
    trs.filter(({ isRetry }) => !isRetry).map(({ id }) => id),
  );
};

const SEARCHABLE_LABELS = new Set([
  "owner",
  "suite",
  "package",
  "testClass",
  "testMethod",
  "epic",
  "feature",
  "story",
  "tag",
  "host",
  "thread",
]);

const joinSearchValues = (values: (string | undefined)[]) => {
  const uniqueValues = new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)));

  return uniqueValues.size > 0 ? [...uniqueValues].join(" ") : undefined;
};

const searchDocumentFactory = (test: ReportTestResult): ReportSearchDocument => {
  const labels = (test.labels ?? []).flatMap(({ name, value }) => {
    if (!value || !SEARCHABLE_LABELS.has(name)) {
      return [];
    }

    return [`${name}:${value}`, value];
  });
  const tags = (test.labels ?? []).flatMap(({ name, value }) => (name === "tag" && value ? [value] : []));
  const parameters = (test.parameters ?? []).flatMap(({ name, value, hidden, masked }) => {
    if (hidden) {
      return [];
    }

    return masked ? [name] : [`${name}:${value}`, name, value];
  });

  const links = (test.links ?? []).flatMap(({ name, url, type }) => [name, url, type]);
  const categories = test.categories?.map((category: ReportCategory) => category.name);

  return {
    id: test.id,
    nodeId: test.id,
    name: test.name,
    fullName: test.fullName,
    historyId: test.historyId,
    labels: joinSearchValues(labels),
    owner: joinSearchValues(test.groupedLabels.owner ?? []),
    tags: joinSearchValues(tags),
    parameters: joinSearchValues(parameters),
    categories: joinSearchValues(categories ?? []),
    statusMessage: test.error?.message,
    links: joinSearchValues(links),
  };
};

export const generateSearchIndex = async (
  writer: AwesomeDataWriter,
  trs: ReportTestResult[],
  filename = "search-index.json",
) => {
  const searchDocuments = trs.filter(({ isRetry }) => !isRetry).map(searchDocumentFactory);

  await writer.writeWidget(filename, searchDocuments);
};

export const getRunSummary = (testResults: Pick<TestResult, "start" | "stop">[]): ReportRunSummary | undefined => {
  let start = Infinity;
  let stop = -Infinity;

  for (const { start: s, stop: e } of testResults) {
    if (typeof s === "number" && Number.isFinite(s) && typeof e === "number" && Number.isFinite(e)) {
      start = Math.min(start, s);
      stop = Math.max(stop, e);
    }
  }

  return Number.isFinite(start) && Number.isFinite(stop)
    ? { start, stop, duration: Math.max(0, stop - start) }
    : undefined;
};

export const generateTree = async (
  writer: AwesomeDataWriter,
  treeFilename: string,
  labels: string[],
  tests: ReportTestResult[],
  options?: {
    appendTitlePath?: boolean;
  },
) => {
  const tree = generateTreeData(labels, tests, options);

  await writer.writeWidget(treeFilename, tree);
};

const generateTreeData = (
  labels: string[],
  tests: ReportTestResult[],
  options?: {
    appendTitlePath?: boolean;
  },
) => {
  const visibleTests = tests.filter((test) => !test.isRetry);
  const { appendTitlePath } = options || {};
  let tree: TreeData<ReportTreeLeaf, ReportTreeGroup>;

  if (labels.length === 0) {
    tree = buildTreeByTitlePath(visibleTests);
  } else if (appendTitlePath && labels.length) {
    tree = buildTreeByLabelsAndTitlePathCombined(visibleTests, labels);
  } else {
    tree = buildTreeByLabels(visibleTests, labels);
  }

  processTree(tree, {
    sort: nullsLast(compareBy("start", ordinal())),
    transform: (leaf, idx) => ({ ...leaf, groupOrder: idx + 1 }),
  });

  return tree;
};

const buildTreeByLabels = (tests: ReportTestResult[], labels: string[]): TreeData<ReportTreeLeaf, ReportTreeGroup> => {
  return createTreeByLabels<ReportTestResult, ReportTreeLeaf, ReportTreeGroup>(
    tests,
    labels,
    leafFactory,
    undefined,
    (group, leaf) => {
      incrementStatistic(group.statistic, leaf.status);
    },
  );
};

const buildTreeByTitlePath = (tests: ReportTestResult[]): TreeData<ReportTreeLeaf, ReportTreeGroup> => {
  const testsWithTitlePath: ReportTestResult[] = [];
  const testsWithoutTitlePath: ReportTestResult[] = [];

  for (const test of tests) {
    if (Array.isArray(test.titlePath) && test.titlePath.length > 0) {
      testsWithTitlePath.push(test);
    } else {
      testsWithoutTitlePath.push(test);
    }
  }

  const treeByTitlePath = createTreeByTitlePath<ReportTestResult>(
    testsWithTitlePath,
    leafFactory,
    undefined,
    (group, leaf) => incrementStatistic(group.statistic, leaf.status),
  ) as TreeData<ReportTreeLeaf, ReportTreeGroup>;

  if (!testsWithoutTitlePath.length) {
    return treeByTitlePath;
  }

  const defaultLabels = preciseTreeLabels(
    ["parentSuite", "suite", "subSuite"],
    testsWithoutTitlePath,
    ({ labels }: { labels: TestLabel[] }) => labels.map(({ name }: TestLabel) => name),
  );

  let treeByDefaultLabels: TreeData<ReportTreeLeaf, ReportTreeGroup> | null = null;

  if (defaultLabels.length) {
    treeByDefaultLabels = createTreeByLabelsAndTitlePath<ReportTestResult, ReportTreeLeaf, ReportTreeGroup>(
      testsWithoutTitlePath,
      defaultLabels,
      leafFactory,
      undefined,
      (group, leaf) => incrementStatistic(group.statistic, leaf.status),
    );
  } else {
    for (const test of testsWithoutTitlePath) {
      const leaf = leafFactory(test);
      treeByTitlePath.leavesById[leaf.nodeId] = leaf;
      if (!treeByTitlePath.root.leaves) {
        treeByTitlePath.root.leaves = [];
      }
      treeByTitlePath.root.leaves.push(leaf.nodeId);
    }

    return treeByTitlePath;
  }

  const mergedLeavesById = {
    ...treeByTitlePath.leavesById,
    ...treeByDefaultLabels.leavesById,
  };

  const mergedGroupsById = {
    ...treeByTitlePath.groupsById,
    ...treeByDefaultLabels.groupsById,
  };

  const mergedRootLeaves = Array.from(
    new Set([...(treeByTitlePath.root.leaves ?? []), ...(treeByDefaultLabels.root.leaves ?? [])]),
  );

  const mergedRootGroups = Array.from(
    new Set([...(treeByTitlePath.root.groups ?? []), ...(treeByDefaultLabels.root.groups ?? [])]),
  );

  return {
    root: {
      leaves: mergedRootLeaves,
      groups: mergedRootGroups,
    },
    leavesById: mergedLeavesById,
    groupsById: mergedGroupsById,
  };
};

const buildTreeByLabelsAndTitlePathCombined = (
  tests: ReportTestResult[],
  labels: string[],
): TreeData<ReportTreeLeaf, ReportTreeGroup> =>
  collapseTreeGroups(
    createTreeByLabelsAndTitlePath<ReportTestResult, ReportTreeLeaf, ReportTreeGroup>(
      tests,
      labels,
      leafFactory,
      undefined,
      (group: ReportTreeGroup, leaf: ReportTreeLeaf) => incrementStatistic(group.statistic, leaf.status),
    ),
  );

const leafFactory = ({
  id,
  name,
  status,
  duration,
  flaky,
  start,
  retry,
  retriesCount,
  transition,
  tooltips,
  historyId,
  groupedLabels,
  categories,
}: ReportTestResult): ReportTreeLeaf => {
  const leaf: ReportTreeLeaf = {
    nodeId: id,
    id: historyId ?? id,
    name,
    status,
    duration,
    flaky,
    start,
    retry,
    retriesCount,
    transition,
    tooltips,
  };

  if (groupedLabels.tag && groupedLabels.tag.length > 0) {
    leaf.tags = groupedLabels.tag;
  }

  if (categories?.length) {
    leaf.categories = categories.map((category: ReportCategory) => category.name).filter(Boolean);
  }

  return leaf;
};

export const generateEnvironmentJson = async (writer: AwesomeDataWriter, env: EnvironmentItem[]) => {
  await writer.writeWidget("allure_environment.json", env);
};

export const generateEnvirontmentsList = async (writer: AwesomeDataWriter, store: AllureStore) => {
  const environments = await store.allEnvironmentIdentities();

  await writer.writeWidget("environments.json", environments);
};

export const generateVariables = async (writer: AwesomeDataWriter, store: AllureStore) => {
  const reportVariables = await store.allVariables();
  const environments = await store.allEnvironmentIdentities();

  await writer.writeWidget("variables.json", reportVariables);

  for (const env of environments) {
    const envVariables = await store.envVariablesByEnvironmentId(env.id);

    await writer.writeWidget(joinPosixPath(env.id, "variables.json"), envVariables);
  }
};

export const generateStatistic = async (
  writer: AwesomeDataWriter,
  data: {
    stats: Statistic;
    statsByEnv: Map<string, Statistic>;
    envs: EnvironmentIdentity[];
  },
) => {
  const { stats, statsByEnv, envs } = data;

  await writer.writeWidget("statistic.json", stats);
  await writer.writeWidget("pie_chart.json", getPieChartValues(stats));

  for (const env of envs) {
    const envStats = statsByEnv.get(env.id);

    if (!envStats) {
      continue;
    }

    await writer.writeWidget(joinPosixPath(env.id, "statistic.json"), envStats);
    await writer.writeWidget(joinPosixPath(env.id, "pie_chart.json"), envStats);
  }
};

export const generateAttachmentsFiles = async (
  writer: AwesomeDataWriter,
  attachmentLinks: AttachmentLink[],
  contentFunction: (id: string) => Promise<ResultFile | undefined>,
) => {
  const result = new Map<string, string>();
  for (const { id, ext, ...link } of attachmentLinks) {
    if (link.missed) {
      continue;
    }
    const content = await contentFunction(id);

    if (!content) {
      continue;
    }
    const src = `${id}${ext}`;
    await writer.writeAttachment(src, content);
    result.set(id, src);
  }
  return result;
};

export const generateHistoryDataPoints = async (writer: AwesomeDataWriter, store: AllureStore) => {
  const result = new Map<string, string>();
  const allHistoryPoints = await store.allHistoryDataPoints();

  for (const historyPoint of allHistoryPoints.slice(0, 6)) {
    const src = `history/${historyPoint.uuid}.json`;
    await writer.writeData(src, historyPoint);
  }
  return result;
};

export const generateGlobals = async (
  writer: AwesomeDataWriter,
  payload: {
    globalExitCode?: ExitCode;
    globalAttachments?: GlobalAttachmentLink[];
    globalAttachmentsByEnv?: Record<string, GlobalAttachmentLink[]>;
    globalErrors?: PluginGlobalError[];
    globalErrorsByEnv?: Record<string, PluginGlobalError[]>;
    contentFunction: (id: string) => Promise<ResultFile | undefined>;
  },
) => {
  const {
    globalExitCode,
    globalAttachments = [],
    globalAttachmentsByEnv = {},
    globalErrors = [],
    globalErrorsByEnv = {},
    contentFunction,
  } = payload;
  const globals: PluginGlobals = {
    errors: globalErrors,
    attachments: [],
  };
  const attachmentsByEnv: Record<string, GlobalAttachmentLink[]> = {};

  if (globalExitCode) {
    globals.exitCode = globalExitCode;
  }

  for (const attachment of globalAttachments) {
    const src = `${attachment.id}${attachment.ext}`;
    const content = await contentFunction(attachment.id);

    if (!content) {
      continue;
    }

    await writer.writeAttachment(src, content);

    globals.attachments.push(attachment);
  }

  Object.entries(globalAttachmentsByEnv).forEach(([environmentId, attachments]) => {
    const attachmentIds = new Set(globals.attachments.map(({ id }) => id));
    const writtenAttachments = attachments.filter(({ id }) => attachmentIds.has(id));

    if (writtenAttachments.length === 0) {
      return;
    }

    attachmentsByEnv[environmentId] = writtenAttachments;
  });

  if (Object.keys(attachmentsByEnv).length > 0) {
    globals.attachmentsByEnv = attachmentsByEnv;
  }

  if (Object.keys(globalErrorsByEnv).length > 0) {
    globals.errorsByEnv = globalErrorsByEnv;
  }

  await writer.writeWidget("globals.json", globals);
};

export const generateQualityGateResults = async (
  writer: AwesomeDataWriter,
  qualityGateResults: Record<string, QualityGateValidationResult[]> = {},
  options: {
    tests?: ReportTestResult[];
    labels?: string[];
    appendTitlePath?: boolean;
  } = {},
) => {
  const { tests = [], labels = [], appendTitlePath } = options;
  const testsById = new Map(tests.map((test) => [test.id, test] as const));
  const resultsWithTrees = Object.fromEntries(
    Object.entries(qualityGateResults).map(([environment, results]) => [
      environment,
      results.map((result) => {
        const relatedTests = [...new Set(result.testResults ?? [])]
          .map((testResultId) => testsById.get(testResultId))
          .filter((test): test is ReportTestResult => Boolean(test));

        if (relatedTests.length === 0) {
          return result;
        }

        return {
          ...result,
          testResultsTree: generateTreeData(labels, relatedTests, { appendTitlePath }),
        };
      }),
    ]),
  );

  await writer.writeWidget("quality-gate.json", resultsWithTrees);
};

export const generateStaticFiles = async (
  payload: AwesomeOptions & {
    id: string;
    allureVersion: string;
    reportFiles: ReportFiles;
    reportDataFiles: ReportFile[];
    reportUuid: string;
    reportName: string;
    executor?: ReportExecutorInfo;
    runSummary?: ReportRunSummary;
  },
) => {
  const {
    id,
    reportName = "Allure Report",
    reportLanguage = "en",
    logo = "",
    theme = "auto",
    groupBy,
    reportFiles,
    reportDataFiles,
    reportUuid,
    allureVersion,
    layout = "base",
    defaultSection = "",
    ci,
    executor,
    runSummary,
    stepTreeExpansion,
    defaultSortBy,
  } = payload;
  const staticAssets = await readReportStaticAssets(reportStaticArchive);
  const { manifest } = staticAssets;
  const headTags: string[] = [];
  const bodyTags: string[] = [];
  const sections: string[] = payload.sections?.length ? payload.sections : ["charts", "timeline"];

  if (!payload.singleFile) {
    for (const key in manifest) {
      const fileName = manifest[key];

      if (key.includes(".woff")) {
        headTags.push(createFontLinkTag(fileName));
      }

      if (key === "main.css") {
        headTags.push(createStylesLinkTag(fileName));
      }

      if (key === "main.js") {
        bodyTags.push(createScriptTag(fileName));
      }
    }

    await copyReportStaticAssets(staticAssets, reportFiles);
  } else {
    const mainJs = manifest["main.js"];
    const mainCss = manifest["main.css"];

    if (mainCss) {
      const mainCssContent = getReportStaticAsset(staticAssets, mainCss);

      headTags.push(createStylesLinkTag(`data:text/css;base64,${mainCssContent.toString("base64")}`));
    }

    const mainJsContent = getReportStaticAsset(staticAssets, mainJs);

    bodyTags.push(createScriptTag(`data:text/javascript;base64,${mainJsContent.toString("base64")}`));
  }

  const now = Date.now();
  const reportOptions: ReportOptions & { id: string } = {
    id,
    reportName,
    logo,
    theme,
    reportLanguage,
    createdAt: now,
    reportUuid,
    groupBy: groupBy?.length ? groupBy : [],
    cacheKey: now.toString(),
    ci,
    executor,
    runSummary,
    layout,
    allureVersion,
    sections,
    defaultSection,
    stepTreeExpansion,
    defaultSortBy,
  };

  try {
    const html = compiledTemplate({
      headTags: headTags.join("\n"),
      bodyTags: bodyTags.join("\n"),
      reportFilesScript: createReportDataScript(reportDataFiles),
      reportOptions: stringifyForInlineScript(reportOptions),
      analyticsEnable: true,
      allureVersion,
      reportUuid,
      reportName,
      singleFile: payload.singleFile,
    });

    await reportFiles.addFile("index.html", Buffer.from(html, "utf8"));
  } catch (err) {
    if (err instanceof RangeError) {
      // eslint-disable-next-line no-console
      console.error("The report is too large to be generated in the single file mode!");
      process.exit(1);
    }

    throw err;
  }
};

export const generateAllCharts = async (
  writer: AwesomeDataWriter,
  store: AllureStore,
  options: AwesomeOptions,
  context: PluginContext,
): Promise<void> => {
  const { charts = defaultChartsConfig, filter } = options;

  const generatedChartsData = await generateCharts(charts, store, context.reportName, randomUUID, filter);

  if (Object.keys(generatedChartsData.general).length > 0) {
    await writer.writeWidget("charts.json", generatedChartsData);
  }
};

export type AwesomeMetricsWidget = {
  current: MetricSample[];
  history: {
    uuid: string;
    name: string;
    timestamp: number;
    url?: string;
    metrics: Record<string, number>;
  }[];
};

export const generateMetricsWidget = async (
  writer: AwesomeDataWriter,
  store: AllureStore,
  options: {
    currentReportUuid?: string;
    performance?: PluginContext["performance"];
  } = {},
): Promise<boolean> => {
  const { currentReportUuid, performance = {} } = options;
  const current = resolveMetricSamples(
    typeof store.allMetrics === "function" ? await store.allMetrics() : [],
    performance,
  );

  if (current.length === 0) {
    return false;
  }

  const history = (await store.allHistoryDataPoints())
    .filter(({ uuid }) => uuid !== currentReportUuid)
    .filter(({ metrics = {} }) => Object.keys(metrics).length > 0)
    .map(({ uuid, name, timestamp, url, metrics = {} }) => ({
      uuid,
      name,
      timestamp,
      ...(url ? { url } : {}),
      metrics,
    }));

  await writer.writeWidget("metrics.json", {
    current,
    history,
  } satisfies AwesomeMetricsWidget);
  return true;
};

export const generateTreeFilters = async (writer: AwesomeDataWriter, testResults: ReportTestResult[]) => {
  const trTags = new Set<string>();
  const trCategories = new Set<string>();

  for (const tr of testResults) {
    for (const tag of tr.groupedLabels.tag ?? []) {
      trTags.add(tag);
    }

    tr.categories?.forEach((category: ReportCategory) => {
      if (category.name) {
        trCategories.add(category.name);
      }
    });
  }

  const tags = Array.from(trTags).sort((a, b) => a.localeCompare(b));
  const categories = Array.from(trCategories).sort((a, b) => a.localeCompare(b));

  await writer.writeWidget("tree-filters.json", { tags, categories });
};
