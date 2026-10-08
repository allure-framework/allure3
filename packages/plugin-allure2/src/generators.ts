import type { AttachmentLink, GlobalAttachmentLink, HistoryDataPoint, TestError } from "@allurereport/core-api";
import { createBaseUrlScript, createScriptTag, createStylesLinkTag } from "@allurereport/core-api";
import type { ReportFiles, ResultFile } from "@allurereport/plugin-api";
import type { ReportStaticManifest } from "@allurereport/plugin-api/static-assets";
import {
  copyReportStaticAssets,
  getReportStaticAsset,
  readReportStaticAssets,
} from "@allurereport/plugin-api/static-assets";
import Handlebars from "handlebars";

import type {
  Allure2Category,
  Allure2CategoriesTrendItem,
  Allure2DurationTrendItem,
  Allure2ExecutorInfo,
  Allure2GlobalsData,
  Allure2HistoryTrendItem,
  Allure2LegacyHistoryTrendItem,
  Allure2RetryTrendItem,
  Allure2TestResult,
  GroupTime,
  StatusChartData,
  SummaryData,
} from "./model.js";
import type { Classifier, TreeLayer } from "./tree.js";
import { byLabels, collapseTree, createTree, createWidget } from "./tree.js";
import { createStatistic, updateStatistic, updateTime } from "./utils.js";
import type { Allure2DataWriter, ReportFile } from "./writer.js";

export type TemplateManifest = ReportStaticManifest;

const reportStaticArchive = new URL("../dist/static/report.tar", import.meta.url);

const writeConcurrently = async <T>(items: readonly T[], write: (item: T) => Promise<void>, concurrency = 64) => {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(write));
  }
};

const template = `<!DOCTYPE html>
<html dir="ltr" lang="{{reportLanguage}}">
<head>
    <meta charset="utf-8">
    <meta name="allure-report-uuid" content="{{reportUuid}}">
    <title>{{reportName}}</title>
    {{{ headTags }}}
</head>
<body>
    <div id="alert"></div>
    <div id="content">
        <span class="spinner">
            <span class="spinner__circle"></span>
        </span>
    </div>
    <div id="popup"></div>
    <script>
      window.__allureCoreLoaded = new Promise(function (resolve, reject) {
        window.__allureResolveCoreLoaded = resolve;
        window.__allureRejectCoreLoaded = reject;
      });
    </script>
    {{{ bodyTags }}}
    <script>
      if (typeof window.__allureResolveCoreLoaded === "function") {
        window.__allureResolveCoreLoaded([]);
      }
    </script>
    ${createBaseUrlScript()}
    {{#if analyticsEnable}}
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-FVWC4GKEYS"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-FVWC4GKEYS', {
          'allureVersion': '{{allureVersion}}',
          'reportUuid': '{{reportUuid}}',
          'single_file': {{singleFile}}
        });
    </script>
    {{/if}}
    {{{ reportFilesScript }}}
</body>
</html>
`;

const compiledTemplate = Handlebars.compile(template);

const createEmbeddedReportDataScript = (reportFiles: ReportFile[]) => {
  const reportFilesDeclaration = reportFiles
    .map(({ name, value }) => `d(${JSON.stringify(name)},${JSON.stringify(value)})`)
    .join(",");

  return `
    <script>
      window.reportDataReady = false;
      window.reportData = window.reportData || {};

      function d(name, value) {
        return new Promise(function (resolve) {
          window.reportData[name] = value;
          resolve(true);
        });
      }
    </script>
    <script>
      Promise.allSettled([${reportFilesDeclaration}]).then(function () {
        window.reportDataReady = true;
      });
    </script>
  `;
};

export const readTemplateManifest = async (): Promise<TemplateManifest> => {
  const { manifest } = await readReportStaticAssets(reportStaticArchive);

  return manifest;
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
  const staticAssets = await readReportStaticAssets(reportStaticArchive);
  const { manifest } = staticAssets;
  const mainJs = manifest["main.js"];
  const mainCss = manifest["main.css"];
  const headTags: string[] = [];
  const bodyTags: string[] = [];

  if (!singleFile) {
    if (mainCss) {
      headTags.push(createStylesLinkTag(mainCss));
    }

    bodyTags.push(createScriptTag(mainJs));
    await copyReportStaticAssets(staticAssets, reportFiles);
  } else {
    if (mainCss) {
      const mainCssContent = getReportStaticAsset(staticAssets, mainCss);

      headTags.push(createStylesLinkTag(`data:text/css;base64,${mainCssContent.toString("base64")}`));
    }

    const mainJsContent = getReportStaticAsset(staticAssets, mainJs);

    bodyTags.push(createScriptTag(`data:text/javascript;base64,${mainJsContent.toString("base64")}`));
  }

  try {
    const html = compiledTemplate({
      headTags: headTags.join("\n"),
      bodyTags: bodyTags.join("\n"),
      reportFilesScript: singleFile ? createEmbeddedReportDataScript(reportDataFiles) : "",
      analyticsEnable: process.env.ALLURE_NO_ANALYTICS?.toLowerCase() !== "true",
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
  await writeConcurrently(tests, (test) => writer.writeTestCase(test));
};

export const generateSummaryJson = async (
  writer: Allure2DataWriter,
  reportName: string,
  tests: Allure2TestResult[],
) => {
  const statistic = createStatistic();
  const time: GroupTime = {};

  tests
    .filter((test) => !test.isRetry)
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
    .filter((test) => !test.isRetry)
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

const trendIdentity = (executor?: Partial<Allure2ExecutorInfo>) => ({
  buildOrder: executor?.buildOrder,
  reportName: executor?.reportName,
  reportUrl: executor?.reportUrl,
});

const prependTrendItem = <T>(current: T, previous: T[]): T[] => [current, ...previous].slice(0, 20);

export const generateHistoryTrendData = async (
  writer: Allure2DataWriter,
  reportName: string,
  tests: Allure2TestResult[],
  historyDataPoints: HistoryDataPoint[],
  legacyHistory: Allure2LegacyHistoryTrendItem[] = [],
  executor?: Partial<Allure2ExecutorInfo>,
) => {
  const statistic = createStatistic();
  tests
    .filter((test) => !test.isRetry)
    .forEach((test) => {
      updateStatistic(statistic, test);
    });

  const history: Allure2HistoryTrendItem[] = legacyHistory.length
    ? legacyHistory.map(({ data, statistic: legacyStatistic, ...item }) => ({
        ...item,
        data: createStatistic(data ?? legacyStatistic),
      }))
    : historyDataPoints
        .map((point) => {
          const stat = createStatistic();

          Object.values(point.testResults).forEach((testResult) => {
            updateStatistic(stat, testResult);
          });

          return {
            data: stat,
            reportName: point.name,
            reportUrl: point.url,
            timestamp: point.timestamp,
          };
        })
        .sort((left, right) => right.timestamp - left.timestamp)
        .map(({ timestamp: _timestamp, ...item }, index, values) => ({
          ...item,
          buildOrder: values.length - index,
        }));

  const current: Allure2HistoryTrendItem = {
    data: statistic,
    ...(executor
      ? trendIdentity(executor)
      : {
          buildOrder: history.length + 1,
          reportName,
        }),
  };

  await writer.writeWidget("history-trend.json", prependTrendItem(current, history));
};

export const generateDurationTrendData = async (
  writer: Allure2DataWriter,
  tests: Allure2TestResult[],
  history: Allure2DurationTrendItem[] = [],
  executor?: Partial<Allure2ExecutorInfo>,
) => {
  const time: GroupTime = {};
  tests.forEach((test) => updateTime(time, test));

  const current: Allure2DurationTrendItem = {
    data: { duration: time.duration ?? 0 },
    ...trendIdentity(executor),
  };

  await writer.writeWidget("duration-trend.json", prependTrendItem(current, history));
};

export const generateRetryTrendData = async (
  writer: Allure2DataWriter,
  tests: Allure2TestResult[],
  history: Allure2RetryTrendItem[] = [],
  executor?: Partial<Allure2ExecutorInfo>,
) => {
  const current: Allure2RetryTrendItem = {
    data: {
      run: tests.filter((test) => !test.isRetry).length,
      retry: tests.filter((test) => test.isRetry).length,
    },
    ...trendIdentity(executor),
  };

  await writer.writeWidget("retry-trend.json", prependTrendItem(current, history));
};

export const generateCategoriesTrendData = async (
  writer: Allure2DataWriter,
  tests: Allure2TestResult[],
  history: Allure2CategoriesTrendItem[] = [],
  executor?: Partial<Allure2ExecutorInfo>,
) => {
  const categories: Record<string, number> = {};
  tests.forEach((test) => {
    const testCategories: Allure2Category[] = test.extra.categories ?? [];
    testCategories.forEach(({ name }) => {
      categories[name] = (categories[name] ?? 0) + 1;
    });
  });

  const current: Allure2CategoriesTrendItem = {
    data: categories,
    ...trendIdentity(executor),
  };

  await writer.writeWidget("categories-trend.json", prependTrendItem(current, history));
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

export const generateGlobalsData = async (
  writer: Allure2DataWriter,
  globalErrors: TestError[],
  globalAttachments: GlobalAttachmentLink[],
  attachmentMap: Map<string, string>,
  attachmentTimestamps: Record<string, number> = {},
  errorTimestamps: Array<number | undefined> = [],
) => {
  const data: Allure2GlobalsData = {
    errors: globalErrors.map(({ message, trace, actual, expected }, index) => ({
      message,
      trace,
      actual,
      expected,
      timestamp: errorTimestamps[index],
    })),
    attachments: globalAttachments.flatMap((attachment) => {
      const source = attachmentMap.get(attachment.id);

      if (!source) {
        return [];
      }

      return [
        {
          uid: attachment.id,
          name: attachment.name,
          source,
          type: attachment.contentType ?? "application/octet-stream",
          size: !attachment.missed ? attachment.contentLength : undefined,
          timestamp: attachment.originalFileName ? attachmentTimestamps[attachment.originalFileName] : undefined,
        },
      ];
    }),
  };

  await writer.writeWidget("globals.json", data);
};
