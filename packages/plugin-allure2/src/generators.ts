import type { AttachmentLink, HistoryDataPoint, Statistic } from "@allurereport/core-api";
import {
  createBaseUrlScript,
  createFaviconLinkTag,
  createReportDataScript,
  createScriptTag,
  createStylesLinkTag,
} from "@allurereport/core-api";
import type { ReportFiles, ResultFile } from "@allurereport/plugin-api";
import type { Allure2ReportOptions } from "@allurereport/web-allure2";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import type {
  Allure2Category,
  Allure2ExecutorInfo,
  Allure2HistoryTrendItem,
  Allure2TestResult,
  GroupTime,
  StatusChartData,
  SummaryData,
} from "./model.js";
import type { Classifier, TreeLayer } from "./tree.js";
import { byLabels, collapseTree, createTree, createWidget } from "./tree.js";
import { updateStatistic, updateTime } from "./utils.js";
import type { Allure2DataWriter, ReportFile } from "./writer.js";

const require = createRequire(import.meta.url);

export type TemplateManifest = Record<string, string>;

const template = `<!DOCTYPE html>
<html dir="ltr" lang="{{reportLanguage}}">
<head>
    <meta charset="utf-8">
    <title>{{reportName}}</title>
    {{{ headTags }}}
    <script>
      window.allureReportOptions = {{{ reportOptions }}};
    </script>
</head>
<body>
    <svg id="__SVG_SPRITE_NODE__" aria-hidden="true" style="position: absolute; width: 0; height: 0"></svg>
    <div id="alert"></div>
    <div id="content">
        <span class="spinner">
            <span class="spinner__circle"></span>
        </span>
    </div>
    <div id="popup"></div>
    {{{ bodyTags }}}
    ${createBaseUrlScript()}
    {{#if analyticsEnable}}
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-LNDJ3J7WT0"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-LNDJ3J7WT0', {
          'allureVersion': '{{allureVersion}}',
          'report':'classic',
          'reportUuid': '{{reportUuid}}',
          'single_file': '{{singleFile}}'
        });
    </script>
    {{/if}}
    {{{ reportFilesScript }}}
</body>
</html>
`;

export const readTemplateManifest = async (singleFileMode?: boolean): Promise<TemplateManifest> => {
  const templateManifestSource = require.resolve(
    `@allurereport/web-allure2/dist/${singleFileMode ? "single" : "multi"}/manifest.json`,
  );
  const templateManifest = await readFile(templateManifestSource, { encoding: "utf-8" });

  return JSON.parse(templateManifest);
};

export const readManifestEntry = async (options: {
  fileName: string;
  singleFile?: boolean;
  mimeType: string;
  reportFiles: ReportFiles;
  inserter: (content: string) => string;
}) => {
  const { fileName, singleFile, mimeType, inserter, reportFiles } = options;
  const filePath = require.resolve(join("@allurereport/web-allure2/dist", singleFile ? "single" : "multi", fileName));
  const scriptContentBuffer = await readFile(filePath);

  if (singleFile) {
    return inserter(`data:${mimeType};base64,${scriptContentBuffer.toString("base64")}`);
  }

  await reportFiles.addFile(fileName, scriptContentBuffer);

  return inserter(fileName);
};

export const generateStaticFiles = async (payload: {
  allureVersion: string;
  reportName: string;
  reportLanguage: string;
  singleFile: boolean;
  reportFiles: ReportFiles;
  reportDataFiles: ReportFile[];
  reportUuid: string;
}) => {
  const { reportName, reportLanguage, singleFile, reportFiles, reportDataFiles, reportUuid, allureVersion } = payload;
  const compile = Handlebars.compile(template);
  const manifest = await readTemplateManifest(singleFile);
  const headTags: string[] = [];
  const bodyTags: string[] = [];

  for (const key in manifest) {
    const fileName = manifest[key];
    const filePath = require.resolve(join("@allurereport/web-allure2/dist", singleFile ? "single" : "multi", fileName));

    if (key === "favicon.ico") {
      const tag = await readManifestEntry({
        fileName,
        singleFile,
        reportFiles,
        inserter: createFaviconLinkTag,
        mimeType: "image/x-icon",
      });

      headTags.push(tag);
      continue;
    }

    if (key === "main.css") {
      const tag = await readManifestEntry({
        fileName,
        singleFile,
        reportFiles,
        inserter: createStylesLinkTag,
        mimeType: "text/css",
      });

      headTags.push(tag);
      continue;
    }

    if (key === "main.js") {
      const tag = await readManifestEntry({
        fileName,
        singleFile,
        reportFiles,
        inserter: createScriptTag,
        mimeType: "text/javascript",
      });

      bodyTags.push(tag);
      continue;
    }

    // we don't need to handle another files in single file mode
    if (singleFile) {
      continue;
    }

    const fileContent = await readFile(filePath);

    await reportFiles.addFile(basename(filePath), fileContent);
  }

  const reportOptions: Allure2ReportOptions = {
    reportName: reportName ?? "Allure Report",
    reportLanguage: reportLanguage ?? "en",
    createdAt: Date.now(),
    // UI is served from `<report>/<pluginId>/`, while shared store assets are placed at report root
    // (e.g. `<report>/data/attachments/*`).
    storeBaseUrl: "../",
  };

  try {
    const html = compile({
      headTags: headTags.join("\n"),
      bodyTags: bodyTags.join("\n"),
      reportFilesScript: createReportDataScript(reportDataFiles),
      reportOptions: JSON.stringify(reportOptions),
      analyticsEnable: true,
      allureVersion,
      reportLanguage,
      reportUuid,
      reportName,
      singleFile,
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

export const generateTree = async (
  writer: Allure2DataWriter,
  name: string,
  labelNames: string[],
  tests: Allure2TestResult[],
) => {
  const fileName = `${name}.json`;
  const data = createTree(tests, byLabels(labelNames));

  await writer.writeData(fileName, data);

  const widgetData = createWidget(data);

  await writer.writeWidget(fileName, widgetData);
};

export const generatePackagesData = async (writer: Allure2DataWriter, tests: Allure2TestResult[]) => {
  const classifier: Classifier = (test) => {
    return (
      test.labels
        .find((label) => label.name === "package")
        ?.value?.split(".")
        ?.map((group) => ({
          groups: [group],
        })) ?? []
    );
  };
  const data = createTree(tests, classifier);

  const packagesData = collapseTree(data);
  await writer.writeData("packages.json", packagesData);
};

export const generateCategoriesData = async (writer: Allure2DataWriter, tests: Allure2TestResult[]) => {
  const classifier: Classifier = (test) => {
    const byMessage: TreeLayer = { groups: [test.statusMessage ?? "No message"] };
    const categories: Allure2Category[] | undefined = test.extra.categories;
    if (!categories || categories.length === 0) {
      // exclude from the tree
      return undefined;
    }

    const groups = categories.map((c) => c.name);
    return [{ groups }, byMessage];
  };
  const data = createTree(tests, classifier);

  const fileName = "categories.json";
  await writer.writeData(fileName, data);

  const widgetData = createWidget(data);
  await writer.writeWidget(fileName, widgetData);
};

export const generateTimelineData = async (writer: Allure2DataWriter, tests: Allure2TestResult[]) => {
  const classifier: Classifier = (test) => {
    return [{ groups: [test.hostId ?? "Default"] }, { groups: [test.threadId ?? "Default"] }];
  };
  const data = createTree(tests, classifier);
  await writer.writeData("timeline.json", data);
};

export const generateTestResults = async (writer: Allure2DataWriter, tests: Allure2TestResult[]) => {
  for (const test of tests) {
    await writer.writeTestCase(test);
  }
};

export const generateSummaryJson = async (
  writer: Allure2DataWriter,
  reportName: string,
  tests: Allure2TestResult[],
) => {
  const statistic: Statistic = { total: 0 };
  const time: GroupTime = {};

  tests
    .filter((test) => !test.hidden)
    .forEach((test) => {
      updateStatistic(statistic, test);
      updateTime(time, test);
    });

  const data: SummaryData = {
    reportName,
    statistic,
    time,
  };

  await writer.writeWidget("summary.json", data);
};

export const generateEnvironmentJson = async (
  writer: Allure2DataWriter,
  env: {
    name: string;
    values: string[];
  }[],
) => {
  await writer.writeWidget("environment.json", env);
};

export const generateExecutorJson = async (writer: Allure2DataWriter, executor?: Partial<Allure2ExecutorInfo>) => {
  await writer.writeWidget("executors.json", executor ? [executor] : []);
};

export const generateDefaultWidgetData = async (
  writer: Allure2DataWriter,
  tests: Allure2TestResult[],
  ...fileNames: string[]
) => {
  const statusChartData = tests
    .filter((test) => !test.hidden)
    .map(({ uid, name, status, time, extra: { severity = "normal" } }) => {
      return {
        uid,
        name,
        status,
        time,
        severity,
      } as StatusChartData;
    });

  for (const fileName of fileNames) {
    await writer.writeWidget(fileName, statusChartData);
  }
};

export const generateEmptyTrendData = async (writer: Allure2DataWriter, ...fileNames: string[]) => {
  for (const fileName of fileNames) {
    await writer.writeWidget(fileName, [
      {
        uid: "invalid",
        name: "invalid",
        statistic: { total: 0 },
      },
    ]);
  }
};

export const generateTrendData = async (
  writer: Allure2DataWriter,
  reportName: string,
  tests: Allure2TestResult[],
  historyDataPoints: HistoryDataPoint[],
) => {
  const statistic: Statistic = { total: 0 };
  tests
    .filter((test) => !test.hidden)
    .forEach((test) => {
      updateStatistic(statistic, test);
    });

  const history = historyDataPoints.map((point) => {
    const stat: Statistic = { total: 0 };

    Object.values(point.testResults).forEach((testResult) => {
      updateStatistic(stat, testResult);
    });

    return {
      data: stat,
      timestamp: point.timestamp,
      reportName: point.name,
    } as Allure2HistoryTrendItem & { timestamp: number };
  });

  history
    .sort((a, b) => b.timestamp - a.timestamp)
    .forEach((element, index) => {
      element.buildOrder = history.length - index;
    });

  const data = [
    {
      data: statistic,
      timestamp: new Date().getTime(),
      buildOrder: history.length + 1,
      reportName: reportName,
    },
    ...history,
  ];

  await writer.writeWidget("history-trend.json", data);
};

export const generateAttachmentsData = async (
  writer: Allure2DataWriter,
  attachmentLinks: AttachmentLink[],
  contentFunction: (id: string) => Promise<ResultFile | undefined>,
): Promise<Map<string, string>> => {
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
