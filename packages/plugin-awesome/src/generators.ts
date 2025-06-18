import {
  type AttachmentLink,
  type EnvironmentItem,
  compareBy,
  incrementStatistic,
  nullsLast,
  ordinal,
} from "@allurereport/core-api";
import {
  type AllureStore,
  type ReportFiles,
  type ResultFile,
  type TestResultFilter,
  filterTree,
} from "@allurereport/plugin-api";
import { createTreeByLabels, sortTree, transformTree } from "@allurereport/plugin-api";
import type {
  AwesomeFixtureResult,
  AwesomeReportOptions,
  AwesomeTestResult,
  AwesomeTreeGroup,
  AwesomeTreeLeaf,
} from "@allurereport/web-awesome";
import {
  createBaseUrlScript,
  createFontLinkTag,
  createReportDataScript,
  createScriptTag,
  createStylesLinkTag,
  getPieChartData,
} from "@allurereport/web-commons";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { convertFixtureResult, convertTestResult } from "./converters.js";
import { filterEnv } from "./environments.js";
import type { AwesomeOptions, TemplateManifest } from "./model.js";
import type { AwesomeDataWriter, ReportFile } from "./writer.js";

const require = createRequire(import.meta.url);

const template = `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
    <meta charset="utf-8">
    <title> {{ reportName }} </title>
    <link rel="icon" href="favicon.ico">
    {{{ headTags }}}
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
    <script>
      window.allureReportOptions = {{{ reportOptions }}}
    </script>
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

export const generateTestResults = async (writer: AwesomeDataWriter, store: AllureStore, filter?: TestResultFilter) => {
  const allTr = (await store.allTestResults({ includeHidden: true })).filter((tr) => (filter ? filter(tr) : true));
  let convertedTrs: AwesomeTestResult[] = [];

  for (const tr of allTr) {
    const trFixtures = await store.fixturesByTrId(tr.id);
    const convertedTrFixtures: AwesomeFixtureResult[] = trFixtures.map(convertFixtureResult);
    const convertedTr: AwesomeTestResult = convertTestResult(tr);

    convertedTr.history = await store.historyByTrId(tr.id);
    convertedTr.retries = await store.retriesByTrId(tr.id);
    convertedTr.retry = convertedTr.retries.length > 0;
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

export const generateTestEnvGroups = async (writer: AwesomeDataWriter, store: AllureStore) => {
  const groups = await store.allTestEnvGroups();

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
) => {
  const visibleTests = tests.filter((test) => !test.hidden);
  const tree = createTreeByLabels<AwesomeTestResult, AwesomeTreeLeaf, AwesomeTreeGroup>(
    visibleTests,
    labels,
    ({ id, name, status, duration, flaky, start, retries }) => {
      const retriesCount = retries?.length;

      return {
        nodeId: id,
        retry: Boolean(retriesCount),
        retriesCount,
        name,
        status,
        duration,
        flaky,
        start,
      };
    },
    undefined,
    (group, leaf) => {
      incrementStatistic(group.statistic, leaf.status);
    },
  );

  // @ts-ignore
  filterTree(tree, (leaf) => !leaf.hidden);
  sortTree(tree, nullsLast(compareBy("start", ordinal())));
  transformTree(tree, (leaf, idx) => ({ ...leaf, groupOrder: idx + 1 }));

  await writer.writeWidget(treeFilename, tree);
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

export const generateStatistic = async (writer: AwesomeDataWriter, store: AllureStore, filter?: TestResultFilter) => {
  const statistic = await store.testsStatistic(filter);
  const environments = await store.allEnvironments();

  await writer.writeWidget("statistic.json", statistic);

  for (const env of environments) {
    const envStatistic = await store.testsStatistic(filterEnv(env, filter));

    await writer.writeWidget(join(env, "statistic.json"), envStatistic);
  }
};

export const generatePieChart = async (writer: AwesomeDataWriter, store: AllureStore, filter?: TestResultFilter) => {
  const reportStatistic = await store.testsStatistic(filter);
  const environments = await store.allEnvironments();

  await writer.writeWidget("pie_chart.json", getPieChartData(reportStatistic));

  for (const env of environments) {
    const envStatistic = await store.testsStatistic(filterEnv(env, filter));

    await writer.writeWidget(join(env, "pie_chart.json"), getPieChartData(envStatistic));
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

export const generateStaticFiles = async (
  payload: AwesomeOptions & {
    allureVersion: string;
    reportFiles: ReportFiles;
    reportDataFiles: ReportFile[];
    reportUuid: string;
    reportName: string;
  },
) => {
  const {
    reportName = "Allure Report",
    reportLanguage = "en",
    singleFile,
    logo = "",
    theme = "light",
    groupBy,
    reportFiles,
    reportDataFiles,
    reportUuid,
    allureVersion,
    layout = "base",
    charts = [],
    defaultSection = "",
  } = payload;
  const compile = Handlebars.compile(template);
  const manifest = await readTemplateManifest(payload.singleFile);
  const headTags: string[] = [];
  const bodyTags: string[] = [];
  const sections: string[] = [];

  if (charts.length) {
    sections.push("charts");
  }

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
  const reportOptions: AwesomeReportOptions = {
    reportName,
    logo,
    theme,
    reportLanguage,
    createdAt: now,
    reportUuid,
    groupBy: groupBy?.length ? groupBy : ["parentSuite", "suite", "subSuite"],
    cacheKey: now.toString(),
    layout,
    allureVersion,
    sections,
    defaultSection,
  };
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
};
