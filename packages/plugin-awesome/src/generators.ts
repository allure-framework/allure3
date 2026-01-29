import { defaultChartsConfig } from "@allurereport/charts-api";
import {
  type AttachmentLink,
  type EnvironmentItem,
  type Statistic,
  type TestEnvGroup,
  type TestError,
  type TestResult,
  type TreeData,
  compareBy,
  createBaseUrlScript,
  createFontLinkTag,
  createReportDataScript,
  createScriptTag,
  createStylesLinkTag,
  incrementStatistic,
  nullsLast,
  ordinal,
} from "@allurereport/core-api";
import type {
  AllureStore,
  ExitCode,
  PluginContext,
  PluginGlobals,
  QualityGateValidationResult,
  ReportFiles,
  ResultFile,
  TestResultFilter,
} from "@allurereport/plugin-api";
import {
  createTreeByLabels,
  createTreeByLabelsAndTitlePath,
  createTreeByTitlePath,
  filterTree,
  preciseTreeLabels,
  sortTree,
  transformTree,
} from "@allurereport/plugin-api";
import type {
  AwesomeFixtureResult,
  AwesomeReportOptions,
  AwesomeTestResult,
  AwesomeTreeGroup,
  AwesomeTreeLeaf,
} from "@allurereport/web-awesome";
import { generateCharts, getPieChartValues } from "@allurereport/web-commons";
import Handlebars from "handlebars";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { convertFixtureResult, convertTestResult } from "./converters.js";
import type { AwesomeOptions, TemplateManifest } from "./model.js";
import type { AwesomeDataWriter, ReportFile } from "./writer.js";

const require = createRequire(import.meta.url);

const template = `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
    <meta charset="utf-8">
    <title> {{ reportName }} </title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg width='32' height='32' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M22.232 4.662a3.6 3.6 0 0 1 5.09.035c2.855 2.894 4.662 6.885 4.662 11.295a3.6 3.6 0 0 1-7.2 0c0-2.406-.981-4.61-2.587-6.24a3.6 3.6 0 0 1 .035-5.09Z' fill='url(%23a)'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M12.392 3.6a3.6 3.6 0 0 1 3.6-3.6c4.41 0 8.401 1.807 11.296 4.662a3.6 3.6 0 1 1-5.056 5.126C20.602 8.18 18.398 7.2 15.992 7.2a3.6 3.6 0 0 1-3.6-3.6Z' fill='url(%23b)'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M0 15.992C0 7.157 7.157 0 15.992 0a3.6 3.6 0 0 1 0 7.2A8.789 8.789 0 0 0 7.2 15.992c0 2.406.981 4.61 2.588 6.24a3.6 3.6 0 0 1-5.126 5.056C1.807 24.393 0 20.402 0 15.992Z' fill='url(%23c)'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M4.661 22.232a3.6 3.6 0 0 1 5.091-.035c1.63 1.606 3.834 2.587 6.24 2.587a3.6 3.6 0 0 1 0 7.2c-4.41 0-8.401-1.807-11.295-4.661a3.6 3.6 0 0 1-.036-5.091Z' fill='url(%23d)'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M28.384 12.392a3.6 3.6 0 0 1 3.6 3.6c0 8.835-7.157 15.992-15.992 15.992a3.6 3.6 0 0 1 0-7.2 8.789 8.789 0 0 0 8.792-8.792 3.6 3.6 0 0 1 3.6-3.6Z' fill='url(%23e)'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M28.385 12.392a3.6 3.6 0 0 1 3.6 3.6v12.392a3.6 3.6 0 0 1-7.2 0V15.992a3.6 3.6 0 0 1 3.6-3.6Z' fill='url(%23f)'/%3E%3Cg clip-path='url(%23g)'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M22.232 4.662a3.6 3.6 0 0 1 5.091.035c2.855 2.894 4.662 6.885 4.662 11.295a3.6 3.6 0 0 1-7.2 0c0-2.406-.982-4.61-2.588-6.24a3.6 3.6 0 0 1 .035-5.09Z' fill='url(%23h)'/%3E%3C/g%3E%3Cdefs%3E%3ClinearGradient id='a' x1='26.4' y1='9.6' x2='28.8' y2='15' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%237E22CE'/%3E%3Cstop offset='1' stop-color='%238B5CF6'/%3E%3C/linearGradient%3E%3ClinearGradient id='b' x1='26.8' y1='9.4' x2='17.8' y2='3.6' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23EF4444'/%3E%3Cstop offset='1' stop-color='%23DC2626'/%3E%3C/linearGradient%3E%3ClinearGradient id='c' x1='3.6' y1='14' x2='5.4' y2='24.8' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%2322C55E'/%3E%3Cstop offset='1' stop-color='%2315803D'/%3E%3C/linearGradient%3E%3ClinearGradient id='d' x1='4.8' y1='22.2' x2='14.4' y2='29.2' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%2394A3B8'/%3E%3Cstop offset='.958' stop-color='%2364748B'/%3E%3Cstop offset='1' stop-color='%2364748B'/%3E%3C/linearGradient%3E%3ClinearGradient id='e' x1='28.4' y1='22.173' x2='22.188' y2='28.384' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23D97706'/%3E%3Cstop offset='1' stop-color='%23FBBF24'/%3E%3C/linearGradient%3E%3ClinearGradient id='f' x1='29.2' y1='54.4' x2='30.626' y2='54.256' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%23FBBF24'/%3E%3Cstop offset='1' stop-color='%23FBBF24'/%3E%3C/linearGradient%3E%3ClinearGradient id='h' x1='26.4' y1='9.6' x2='28.8' y2='15' gradientUnits='userSpaceOnUse'%3E%3Cstop stop-color='%237E22CE'/%3E%3Cstop offset='1' stop-color='%238B5CF6'/%3E%3C/linearGradient%3E%3CclipPath id='g'%3E%3Cpath fill='%23fff' transform='translate(24.8 12)' d='M0 0h7.2v8H0z'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E" />
    {{{ headTags }}}
    <script>
      window.allureReportOptions = {{{ reportOptions }}}
    </script>
</head>
<body>
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

export const readTemplateManifest = async (singleFileMode?: boolean): Promise<TemplateManifest> => {
  const templateManifestSource = require.resolve(
    `@allurereport/web-awesome/dist/${singleFileMode ? "single" : "multi"}/manifest.json`,
  );
  const templateManifest = await readFile(templateManifestSource, { encoding: "utf-8" });

  return JSON.parse(templateManifest);
};

const createBreadcrumbs = (convertedTr: AwesomeTestResult) => {
  const labelsByType = convertedTr.labels.reduce(
    (acc, label) => {
      if (!acc[label.name]) {
        acc[label.name] = [];
      }
      acc[label.name].push(label.value || "");
      return acc;
    },
    {} as Record<string, string[]>,
  );

  const parentSuites = labelsByType.parentSuite || [""];
  const suites = labelsByType.suite || [""];
  const subSuites = labelsByType.subSuite || [""];

  return parentSuites.reduce((acc, parentSuite) => {
    suites.forEach((suite) => {
      subSuites.forEach((subSuite) => {
        const path = [parentSuite, suite, subSuite].filter(Boolean);
        if (path.length > 0) {
          acc.push(path);
        }
      });
    });
    return acc;
  }, [] as string[][]);
};

export const generateTestResults = async (
  writer: AwesomeDataWriter,
  store: AllureStore,
  trs: TestResult[],
  filter?: TestResultFilter,
) => {
  const allTr = trs.filter((tr) => (filter ? filter(tr) : true));
  let convertedTrs: AwesomeTestResult[] = [];

  for (const tr of allTr) {
    const trFixtures = await store.fixturesByTrId(tr.id);
    const convertedTrFixtures: AwesomeFixtureResult[] = trFixtures.map(convertFixtureResult);
    const convertedTr: AwesomeTestResult = convertTestResult(tr);

    convertedTr.history = (await store.historyByTrId(tr.id)) ?? [];
    convertedTr.retries = await store.retriesByTrId(tr.id);
    convertedTr.retriesCount = convertedTr.retries.length;
    convertedTr.retry = convertedTr.retriesCount > 0;
    convertedTr.setup = convertedTrFixtures.filter((f) => f.type === "before");
    convertedTr.teardown = convertedTrFixtures.filter((f) => f.type === "after");
    // FIXME: the type is correct, but typescript still shows an error
    // @ts-ignore
    convertedTr.attachments = (await store.attachmentsByTrId(tr.id)).map((attachment) => ({
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

  for (const convertedTr of convertedTrs) {
    await writer.writeTestCase(convertedTr);
  }

  return convertedTrs;
};

export const generateTestCases = async (writer: AwesomeDataWriter, trs: AwesomeTestResult[]) => {
  for (const tr of trs) {
    await writer.writeTestCase(tr);
  }
};

export const generateTestEnvGroups = async (writer: AwesomeDataWriter, groups: TestEnvGroup[]) => {
  for (const group of groups) {
    const src = join("test-env-groups", `${group.id}.json`);

    await writer.writeData(src, group);
  }
};

export const generateNav = async (writer: AwesomeDataWriter, trs: AwesomeTestResult[], filename = "nav.json") => {
  await writer.writeWidget(
    filename,
    trs.filter(({ hidden }) => !hidden).map(({ id }) => id),
  );
};

export const generateTree = async (
  writer: AwesomeDataWriter,
  treeFilename: string,
  labels: string[],
  tests: AwesomeTestResult[],
  options?: {
    appendTitlePath?: boolean;
  },
) => {
  const visibleTests = tests.filter((test) => !test.hidden);
  const { appendTitlePath } = options || {};
  let tree: TreeData<AwesomeTreeLeaf, AwesomeTreeGroup>;

  if (labels.length === 0) {
    tree = buildTreeByTitlePath(visibleTests);
  } else if (appendTitlePath && labels.length) {
    tree = buildTreeByLabelsAndTitlePathCombined(visibleTests, labels);
  } else {
    tree = buildTreeByLabels(visibleTests, labels);
  }

  // @ts-ignore
  filterTree(tree, (leaf) => !leaf.hidden);
  sortTree(tree, nullsLast(compareBy("start", ordinal())));
  transformTree(tree, (leaf, idx) => ({ ...leaf, groupOrder: idx + 1 }));

  await writer.writeWidget(treeFilename, tree);
};

const buildTreeByLabels = (
  tests: AwesomeTestResult[],
  labels: string[],
): TreeData<AwesomeTreeLeaf, AwesomeTreeGroup> => {
  return createTreeByLabels<AwesomeTestResult, AwesomeTreeLeaf, AwesomeTreeGroup>(
    tests,
    labels,
    leafFactory,
    undefined,
    (group, leaf) => {
      incrementStatistic(group.statistic, leaf.status);
    },
  );
};

const buildTreeByTitlePath = (tests: AwesomeTestResult[]): TreeData<AwesomeTreeLeaf, AwesomeTreeGroup> => {
  const testsWithTitlePath: AwesomeTestResult[] = [];
  const testsWithoutTitlePath: AwesomeTestResult[] = [];

  for (const test of tests) {
    if (Array.isArray(test.titlePath) && test.titlePath.length > 0) {
      testsWithTitlePath.push(test);
    } else {
      testsWithoutTitlePath.push(test);
    }
  }

  const treeByTitlePath = createTreeByTitlePath<AwesomeTestResult>(
    testsWithTitlePath,
    leafFactory,
    undefined,
    (group, leaf) => incrementStatistic(group.statistic, leaf.status),
  ) as TreeData<AwesomeTreeLeaf, AwesomeTreeGroup>;

  if (!testsWithoutTitlePath.length) {
    return treeByTitlePath;
  }

  const defaultLabels = preciseTreeLabels(["parentSuite", "suite", "subSuite"], testsWithoutTitlePath, ({ labels }) =>
    labels.map(({ name }) => name),
  );

  let treeByDefaultLabels: TreeData<AwesomeTreeLeaf, AwesomeTreeGroup> | null = null;

  if (defaultLabels.length) {
    treeByDefaultLabels = createTreeByLabelsAndTitlePath<AwesomeTestResult, AwesomeTreeLeaf, AwesomeTreeGroup>(
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
  tests: AwesomeTestResult[],
  labels: string[],
): TreeData<AwesomeTreeLeaf, AwesomeTreeGroup> =>
  createTreeByLabelsAndTitlePath<AwesomeTestResult, AwesomeTreeLeaf, AwesomeTreeGroup>(
    tests,
    labels,
    leafFactory,
    undefined,
    (group, leaf) => incrementStatistic(group.statistic, leaf.status),
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
}: AwesomeTestResult): AwesomeTreeLeaf => {
  const leaf: AwesomeTreeLeaf = {
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

  return leaf;
};

export const generateEnvironmentJson = async (writer: AwesomeDataWriter, env: EnvironmentItem[]) => {
  await writer.writeWidget("allure_environment.json", env);
};

export const generateEnvirontmentsList = async (writer: AwesomeDataWriter, store: AllureStore) => {
  const environments = await store.allEnvironments();

  await writer.writeWidget("environments.json", environments);
};

export const generateVariables = async (writer: AwesomeDataWriter, store: AllureStore) => {
  const reportVariables = await store.allVariables();
  const environments = await store.allEnvironments();

  await writer.writeWidget("variables.json", reportVariables);

  for (const env of environments) {
    const envVariables = await store.envVariables(env);

    await writer.writeWidget(join(env, "variables.json"), envVariables);
  }
};

export const generateStatistic = async (
  writer: AwesomeDataWriter,
  data: {
    stats: Statistic;
    statsByEnv: Map<string, Statistic>;
    envs: string[];
  },
) => {
  const { stats, statsByEnv, envs } = data;

  await writer.writeWidget("statistic.json", stats);
  await writer.writeWidget("pie_chart.json", getPieChartValues(stats));

  for (const env of envs) {
    const envStats = statsByEnv.get(env);

    if (!envStats) {
      continue;
    }

    await writer.writeWidget(join(env, "statistic.json"), envStats);
    await writer.writeWidget(join(env, "pie_chart.json"), envStats);
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
      return;
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
    globalAttachments?: AttachmentLink[];
    globalErrors?: TestError[];
    contentFunction: (id: string) => Promise<ResultFile | undefined>;
  },
) => {
  const { globalExitCode, globalAttachments = [], globalErrors = [], contentFunction } = payload;
  const globals: PluginGlobals = {
    errors: globalErrors,
    attachments: [],
  };

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

  await writer.writeWidget("globals.json", globals);
};

export const generateQualityGateResults = async (
  writer: AwesomeDataWriter,
  qualityGateResults: QualityGateValidationResult[] = [],
) => {
  await writer.writeWidget("quality-gate.json", qualityGateResults);
};

export const generateStaticFiles = async (
  payload: AwesomeOptions & {
    id: string;
    allureVersion: string;
    reportFiles: ReportFiles;
    reportDataFiles: ReportFile[];
    reportUuid: string;
    reportName: string;
  },
) => {
  const {
    id,
    reportName = "Allure Report",
    reportLanguage = "en",
    singleFile,
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
  } = payload;
  const compile = Handlebars.compile(template);
  const manifest = await readTemplateManifest(payload.singleFile);
  const headTags: string[] = [];
  const bodyTags: string[] = [];
  const sections: string[] = ["charts", "timeline"];

  if (!payload.singleFile) {
    for (const key in manifest) {
      const fileName = manifest[key];
      const filePath = require.resolve(
        join("@allurereport/web-awesome/dist", singleFile ? "single" : "multi", fileName),
      );

      if (key.includes(".woff")) {
        headTags.push(createFontLinkTag(fileName));
      }

      if (key === "main.css") {
        headTags.push(createStylesLinkTag(fileName));
      }

      if (key === "main.js") {
        bodyTags.push(createScriptTag(fileName));
      }

      // we don't need to handle another files in single file mode
      if (singleFile) {
        continue;
      }

      const fileContent = await readFile(filePath);

      await reportFiles.addFile(basename(filePath), fileContent);
    }
  } else {
    const mainJs = manifest["main.js"];
    const mainJsSource = require.resolve(`@allurereport/web-awesome/dist/single/${mainJs}`);
    const mainJsContent = await readFile(mainJsSource);

    bodyTags.push(createScriptTag(`data:text/javascript;base64,${mainJsContent.toString("base64")}`));
  }

  const now = Date.now();
  const reportOptions: AwesomeReportOptions & { id: string } = {
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
    layout,
    allureVersion,
    sections,
    defaultSection,
  };

  try {
    const html = compile({
      headTags: headTags.join("\n"),
      bodyTags: bodyTags.join("\n"),
      reportFilesScript: createReportDataScript(reportDataFiles),
      reportOptions: JSON.stringify(reportOptions),
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
  const { charts = defaultChartsConfig } = options;

  const generatedChartsData = await generateCharts(charts, store, context.reportName, randomUUID);

  if (Object.keys(generatedChartsData.general).length > 0) {
    await writer.writeWidget("charts.json", generatedChartsData);
  }
};

export const generateTreeFilters = async (writer: AwesomeDataWriter, testResults: AwesomeTestResult[]) => {
  const trTags = new Set<string>();

  for (const tr of testResults) {
    if (tr.labels.length === 0) {
      continue;
    }

    Object.values(tr.groupedLabels.tag ?? []).forEach((tag) => {
      trTags.add(tag);
    });
  }

  // No need to generate a json file if it will be empty
  if (trTags.size === 0) {
    return Promise.resolve();
  }

  const tags = Array.from(trTags).sort((a, b) => a.localeCompare(b));

  await writer.writeWidget("tree-filters.json", { tags });
};
