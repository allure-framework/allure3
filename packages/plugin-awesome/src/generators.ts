import {
  type AttachmentLink,
  type EnvironmentItem,
  type Statistic,
  type TestResult,
  compareBy,
  nullsLast,
  ordinal,
} from "@allurereport/core-api";
import { type AllureStore, type ReportFiles, type ResultFile, filterTree } from "@allurereport/plugin-api";
import { createTreeByLabels, sortTree, transformTree } from "@allurereport/plugin-api";
import type {
  AllureAwesomeFixtureResult,
  AllureAwesomeReportOptions,
  AllureAwesomeTestResult,
} from "@allurereport/web-awesome";
import {
  createBaseUrlScript,
  createFontLinkTag,
  createReportDataScript,
  createScriptTag,
  createStylesLinkTag,
} from "@allurereport/web-commons";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { getChartData } from "./charts.js";
import { convertFixtureResult, convertTestResult } from "./converters.js";
import type { AllureAwesomeOptions, TemplateManifest } from "./model.js";
import type { AllureAwesomeDataWriter, ReportFile } from "./writer.js";

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

const createBreadcrumbs = (convertedTr: AllureAwesomeTestResult) => {
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

export const generateTestResults = async (writer: AllureAwesomeDataWriter, store: AllureStore) => {
  const allTr = await store.allTestResults({ includeHidden: true });
  let convertedTrs: AllureAwesomeTestResult[] = [];

  for (const tr of allTr) {
    const trFixtures = await store.fixturesByTrId(tr.id);
    const convertedTrFixtures: AllureAwesomeFixtureResult[] = trFixtures.map(convertFixtureResult);
    const convertedTr: AllureAwesomeTestResult = convertTestResult(tr);

    convertedTr.history = await store.historyByTrId(tr.id);
    convertedTr.retries = await store.retriesByTrId(tr.id);
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

  await writer.writeWidget(
    "nav.json",
    convertedTrs.filter(({ hidden }) => !hidden).map(({ id }) => id),
  );
};

export const generateTree = async (
  writer: AllureAwesomeDataWriter,
  treeName: string,
  labels: string[],
  tests: TestResult[],
) => {
  const visibleTests = tests.filter((test) => !test.hidden);
  const tree = createTreeByLabels(visibleTests, labels);

  // @ts-ignore
  filterTree(tree, (leaf) => !leaf.hidden);
  sortTree(tree, nullsLast(compareBy("start", ordinal())));
  transformTree(tree, (leaf, idx) => ({ ...leaf, groupOrder: idx + 1 }));

  await writer.writeWidget(`${treeName}.json`, tree);
};

export const generateEnvironmentJson = async (writer: AllureAwesomeDataWriter, env: EnvironmentItem[]) => {
  await writer.writeWidget("allure_environment.json", env);
};

export const generateStatistic = async (writer: AllureAwesomeDataWriter, statistic: Statistic) => {
  await writer.writeWidget("allure_statistic.json", statistic);
};

export const generatePieChart = async (writer: AllureAwesomeDataWriter, statistic: Statistic) => {
  const chartData = getChartData(statistic);

  await writer.writeWidget("allure_pie_chart.json", chartData);
};

export const generateAttachmentsFiles = async (
  writer: AllureAwesomeDataWriter,
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

export const generateHistoryDataPoints = async (writer: AllureAwesomeDataWriter, store: AllureStore) => {
  const result = new Map<string, string>();
  const allHistoryPoints = await store.allHistoryDataPoints();

  for (const historyPoint of allHistoryPoints.slice(0, 6)) {
    const src = `history/${historyPoint.uuid}.json`;
    await writer.writeData(src, historyPoint);
  }
  return result;
};

export const generateStaticFiles = async (
  payload: AllureAwesomeOptions & {
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
    groupBy = "suite",
    reportFiles,
    reportDataFiles,
    reportUuid,
    allureVersion,
  } = payload;
  const compile = Handlebars.compile(template);
  const manifest = await readTemplateManifest(payload.singleFile);
  const headTags: string[] = [];
  const bodyTags: string[] = [];

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
    const mainJsContentBuffer = await readFile(mainJsSource);

    bodyTags.push(createScriptTag(`data:text/javascript;base64,${mainJsContentBuffer.toString("base64")}`));
  }

  const reportOptions: AllureAwesomeReportOptions = {
    reportName,
    logo,
    theme,
    reportLanguage,
    createdAt: Date.now(),
    reportUuid,
    groupBy,
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
