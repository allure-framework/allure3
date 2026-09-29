import { randomUUID } from "node:crypto";

import { defaultChartsConfig } from "@allurereport/charts-api";
import type { TestResult } from "@allurereport/core-api";
import {
  createBaseUrlScript,
  createFontLinkTag,
  createReportDataScript,
  stringifyForInlineScript,
  createScriptTag,
  createStylesLinkTag,
  joinPosixPath,
} from "@allurereport/core-api";
import {
  SHARED_DIR,
  type AllureStore,
  type ReportOptions,
  type PluginContext,
  type ReportFiles,
} from "@allurereport/plugin-api";
import {
  copyReportStaticAssets,
  getReportStaticAsset,
  readReportStaticAssets,
} from "@allurereport/plugin-api/static-assets";
import { generateCharts } from "@allurereport/web-commons";
import Handlebars from "handlebars";

import type { DashboardOptions, DashboardPluginOptions, TemplateManifest } from "./model.js";
import type { DashboardDataWriter, ReportFile } from "./writer.js";

const reportStaticArchive = new URL("../dist/static/report.tar", import.meta.url);

const template = `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
    <meta charset="utf-8">
    <title> {{ reportName }} </title>
    <link rel="icon" href="favicon.ico">
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
          "report": "dashboard",
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

export const readTemplateManifest = async (_singleFileMode?: boolean): Promise<TemplateManifest> => {
  const { manifest } = await readReportStaticAssets(reportStaticArchive);

  return manifest;
};

export const generateAllCharts = async (
  writer: DashboardDataWriter,
  store: AllureStore,
  options: DashboardPluginOptions,
  context: PluginContext,
  filter?: (testResult: TestResult) => boolean,
): Promise<void> => {
  const { layout = defaultChartsConfig } = options;

  const generatedChartsData = await generateCharts(layout, store, context.reportName, randomUUID, filter);

  if (Object.keys(generatedChartsData.general).length > 0) {
    await writer.writeWidget("charts.json", generatedChartsData);
  }
};

export const generateEnvirontmentsList = async (writer: DashboardDataWriter, store: AllureStore) => {
  const environments = await store.allEnvironmentIdentities();

  await writer.writeWidget("environments.json", environments);
};

const SINGLE_FILE_SIZE_WARNING_THRESHOLD = 50 * 1024 * 1024;

export const generateStaticFiles = async (
  payload: DashboardOptions & {
    allureVersion: string;
    reportFiles: ReportFiles;
    sharedReportFiles?: ReportFiles;
    reportDataFiles: ReportFile[];
    reportUuid: string;
    reportName: string;
  },
) => {
  const {
    reportName = "Allure Report",
    reportLanguage = "en",
    logo = "",
    theme = "light",
    reportFiles,
    sharedReportFiles,
    reportDataFiles,
    reportUuid,
    allureVersion,
  } = payload;
  const compile = Handlebars.compile(template);
  const staticAssets = await readReportStaticAssets(reportStaticArchive);
  const { manifest } = staticAssets;
  const headTags: string[] = [];
  const bodyTags: string[] = [];
  const sharedAssetsDir = sharedReportFiles ? "dashboard" : undefined;
  const assetsTarget = sharedReportFiles ?? reportFiles;
  const assetsPrefix = sharedAssetsDir ? `../${joinPosixPath(SHARED_DIR, sharedAssetsDir)}/` : "";

  if (!payload.singleFile) {
    for (const key in manifest) {
      const fileName = manifest[key];

      if (key.includes(".woff")) {
        headTags.push(createFontLinkTag(`${assetsPrefix}${fileName}`));
      }

      if (key === "main.css") {
        headTags.push(createStylesLinkTag(`${assetsPrefix}${fileName}`));
      }
      if (key === "main.js") {
        bodyTags.push(createScriptTag(`${assetsPrefix}${fileName}`));
      }
    }

    await copyReportStaticAssets(staticAssets, assetsTarget, sharedAssetsDir);
  } else {
    const mainJs = manifest["main.js"];
    const mainCss = manifest["main.css"];

    if (mainCss) {
      const mainCssContent = getReportStaticAsset(staticAssets, mainCss);

      headTags.push(createStylesLinkTag(`data:text/css;base64,${mainCssContent.toString("base64")}`));
    }

    const mainJsContentBuffer = getReportStaticAsset(staticAssets, mainJs);

    bodyTags.push(createScriptTag(`data:text/javascript;base64,${mainJsContentBuffer.toString("base64")}`));
  }

  const reportOptions: ReportOptions = {
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
      reportOptions: stringifyForInlineScript(reportOptions),
      analyticsEnable: true,
      allureVersion,
      reportUuid,
      reportName,
      singleFile: payload.singleFile,
    });

    const htmlBuffer = Buffer.from(html, "utf8");

    if (payload.singleFile && htmlBuffer.byteLength > SINGLE_FILE_SIZE_WARNING_THRESHOLD) {
      const sizeMb = (htmlBuffer.byteLength / (1024 * 1024)).toFixed(1);
      const thresholdMb = SINGLE_FILE_SIZE_WARNING_THRESHOLD / (1024 * 1024);

      // eslint-disable-next-line no-console
      console.warn(
        `Warning: the generated single-file report is ${sizeMb} MB. ` +
          `Reports larger than ${thresholdMb} MB may be slow to open in a browser. ` +
          `Consider using multi-file mode instead.`,
      );
    }

    await reportFiles.addFile("index.html", htmlBuffer);
  } catch (err) {
    if (err instanceof RangeError) {
      // eslint-disable-next-line no-console
      console.error("The report is too large to be generated in the single file mode!");
      process.exit(1);
    }

    throw err;
  }
};
