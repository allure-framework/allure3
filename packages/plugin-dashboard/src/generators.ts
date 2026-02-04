import { defaultChartsConfig } from "@allurereport/charts-api";
import type { TestResult } from "@allurereport/core-api";
import {
  createBaseUrlScript,
  createFontLinkTag,
  createReportDataScript,
  createScriptTag,
  createStylesLinkTag,
} from "@allurereport/core-api";
import { type AllureStore, type PluginContext, type ReportFiles } from "@allurereport/plugin-api";
import { generateCharts } from "@allurereport/web-commons";
import type { DashboardReportOptions } from "@allurereport/web-dashboard";
import Handlebars from "handlebars";
import { randomUUID } from "node:crypto";
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

export const readTemplateManifest = async (singleFileMode?: boolean): Promise<TemplateManifest> => {
  const templateManifestSource = require.resolve(
    `@allurereport/web-dashboard/dist/${singleFileMode ? "single" : "multi"}/manifest.json`,
  );
  const templateManifest = await readFile(templateManifestSource, { encoding: "utf-8" });

  return JSON.parse(templateManifest);
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
  const environments = await store.allEnvironments();

  await writer.writeWidget("environments.json", environments);
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
    }

    throw err;
  }
};
