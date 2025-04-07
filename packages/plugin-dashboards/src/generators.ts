import type { AllureStore, PluginContext, ReportFiles } from "@allurereport/plugin-api";
import type { GeneratedChartsData } from "./types.js";
import { getSeverityTrendData } from "./charts/severityTrend.js";
import { getStatusTrendData } from "./charts/statusTrend.js";

import type { DashboardsOptions, DashboardsPluginOptions, TemplateManifest } from "./model.js";
import { ChartType } from "./model.js";
import { randomUUID } from "crypto";
import type { DashboardsDataWriter, ReportFile } from "./writer.js";
import type {
  DashboardsReportOptions,
} from "@allurereport/web-dashboards";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  createBaseUrlScript,
  createFontLinkTag,
  createReportDataScript,
  createScriptTag,
  createStylesLinkTag,
} from "@allurereport/web-commons";

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
          "report": "dashboards",
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
    `@allurereport/web-dashboards/dist/${singleFileMode ? "single" : "multi"}/manifest.json`,
  );
  const templateManifest = await readFile(templateManifestSource, { encoding: "utf-8" });

  return JSON.parse(templateManifest);
};

export const generateCharts = async (options: DashboardsPluginOptions, store: AllureStore, context: PluginContext) => {
  const { layout } = options;

  if (!layout) {
    return undefined;
  }

  const historyDataPoints = await store.allHistoryDataPoints();
  const statistic = await store.testsStatistic();
  const testResults = await store.allTestResults();

  return layout?.reduce((acc, chartOptions) => {
    const { type } = chartOptions;

    const chartId = randomUUID();

    switch (type) {
      case ChartType.STATUS:
        acc[chartId] = getStatusTrendData(statistic, context.reportName, historyDataPoints, chartOptions);
        break;
      case ChartType.SEVERITY:
        acc[chartId] = getSeverityTrendData(testResults, context.reportName, historyDataPoints, chartOptions);
        break;
      default:
        break;
    }

    return acc;
  }, {} as GeneratedChartsData);
};

export const generateAllCharts = async (writer: DashboardsDataWriter, store: AllureStore, options: DashboardsPluginOptions, context: PluginContext) => {
  const charts = await generateCharts(options, store, context);

  if (charts && Object.keys(charts).length > 0) {
    await writer.writeWidget("history-trend.json", { charts });
  }
};


export const generateStaticFiles = async (
  payload: DashboardsOptions & {
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
        join("@allurereport/web-dashboards/dist", singleFile ? "single" : "multi", fileName),
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
    const mainJsSource = require.resolve(`@allurereport/web-dashboards/dist/single/${mainJs}`);
    const mainJsContentBuffer = await readFile(mainJsSource);

    bodyTags.push(createScriptTag(`data:text/javascript;base64,${mainJsContentBuffer.toString("base64")}`));
  }

  const reportOptions: DashboardsReportOptions = {
    reportName,
    logo,
    theme,
    reportLanguage,
    createdAt: Date.now(),
    reportUuid,
    allureVersion,
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
