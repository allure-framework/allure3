import type { PluginInfo } from "@allurereport/plugin-api";
import { createBaseUrlScript, createScriptTag } from "@allurereport/web-commons";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type TemplateManifest = Record<string, string>;

const template = `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
    <meta charset="utf-8">
    <title> {{ reportName }} </title>
    <link rel="icon" href="favicon.ico">
</head>
<body>
    <div id="app"></div>
    ${createBaseUrlScript()}
    <script>
      window.allure = window.allure || {};
    </script>
    {{{ bodyTags }}}
    <script>
      window.reportSummaries = {{{ reportSummaries }}}
    </script>
    {{{ reportFilesScript }}}
</body>
</html>
`;

export const readTemplateManifest = async (): Promise<TemplateManifest> => {
  const templateManifestSource = require.resolve("@allurereport/web-summary/dist/manifest.json");
  const templateManifest = await readFile(templateManifestSource, { encoding: "utf-8" });

  return JSON.parse(templateManifest);
};

export const generateSummaryStaticFiles = async (payload: { summaries: PluginInfo[] }) => {
  const compile = Handlebars.compile(template);
  const manifest = await readTemplateManifest();
  const bodyTags: string[] = [];

  const mainJs = manifest["main.js"];
  const mainJsSource = require.resolve(`@allurereport/web-summary/dist/${mainJs}`);
  const mainJsContentBuffer = await readFile(mainJsSource);

  bodyTags.push(createScriptTag(`data:text/javascript;base64,${mainJsContentBuffer.toString("base64")}`));

  return compile({
    bodyTags: bodyTags.join("\n"),
    analyticsEnable: true,
    reportSummaries: JSON.stringify(payload.summaries),
  });
};
