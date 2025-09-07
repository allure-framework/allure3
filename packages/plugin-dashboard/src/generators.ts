import {
  ChartType,
  createBaseUrlScript,
  createFontLinkTag,
  createReportDataScript,
  createScriptTag,
  createStylesLinkTag,
} from "@allurereport/core-api";
import {
  type AllureChartsStoreData,
  type AllureStore,
  type ComingSoonChartOptions,
  type GeneratedChartData,
  type GeneratedChartsData,
  type PluginContext,
  type ReportFiles,
  generateBarChart,
  generateComingSoonChart,
  generatePieChart,
  generateTrendChart,
} from "@allurereport/plugin-api";
import type { DashboardReportOptions } from "@allurereport/web-dashboard";
import { randomUUID } from "crypto";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import type { DashboardOptions, DashboardPluginOptions, TemplateManifest } from "./model.js";
import type { DashboardDataWriter, ReportFile } from "./writer.js";

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
          "report": "dashboard",
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
    `@allurereport/web-dashboard/dist/${singleFileMode ? "single" : "multi"}/manifest.json`,
  );
  const templateManifest = await readFile(templateManifestSource, { encoding: "utf-8" });

  return JSON.parse(templateManifest);
};

export const generateCharts = async (
  options: DashboardPluginOptions,
  store: AllureStore,
  context: PluginContext,
): Promise<GeneratedChartsData | undefined> => {
  const { layout } = options;

  if (!layout) {
    return undefined;
  }

  const storeData: AllureChartsStoreData = await Promise.all([
    store.allHistoryDataPoints(),
    store.allTestResults(),
    store.testsStatistic(),
  ]).then(([historyDataPoints, testResults, statistic]) => ({
    historyDataPoints,
    testResults,
    statistic,
  }));

  const chartsData: GeneratedChartsData = {};

  for (const chartOptions of layout) {
    const chartId = randomUUID();

    let chart: GeneratedChartData | undefined;

    if (chartOptions.type === ChartType.Trend) {
      chart = generateTrendChart(chartOptions, storeData, context);
    } else if (chartOptions.type === ChartType.Pie) {
      chart = generatePieChart(chartOptions, storeData);
    } else if (chartOptions.type === ChartType.Bar) {
      chart = generateBarChart(chartOptions, storeData);
    }

    if (chart) {
      chartsData[chartId] = chart;
    } else {
      chartsData[chartId] = generateComingSoonChart(chartOptions as ComingSoonChartOptions);
    }
  }

  return chartsData;
};

export const generateAllCharts = async (
  writer: DashboardDataWriter,
  store: AllureStore,
  options: DashboardPluginOptions,
  context: PluginContext,
): Promise<void> => {
  const charts = await generateCharts(options, store, context);

  if (charts && Object.keys(charts).length > 0) {
    await writer.writeWidget("charts.json", charts);
  }
};

export const generateStaticFiles = async (
  payload: DashboardOptions & {
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
        join("@allurereport/web-dashboard/dist", singleFile ? "single" : "multi", fileName),
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
    const mainJsSource = require.resolve(`@allurereport/web-dashboard/dist/single/${mainJs}`);
    const mainJsContentBuffer = await readFile(mainJsSource);

    bodyTags.push(createScriptTag(`data:text/javascript;base64,${mainJsContentBuffer.toString("base64")}`));
  }

  const reportOptions: DashboardReportOptions = {
    reportName,
    logo,
    theme,
    reportLanguage,
    createdAt: Date.now(),
    reportUuid,
    allureVersion,
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
      return;
    }

    throw err;
  }
};
