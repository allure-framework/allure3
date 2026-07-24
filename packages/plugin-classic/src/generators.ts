import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join } from "node:path";

import {
  type AttachmentLink,
  type EnvironmentItem,
  type Statistic,
  type TreeGroup,
  type TreeLeaf,
  compareBy,
  createBaseUrlScript,
  createFontLinkTag,
  createReportDataScript,
  stringifyForInlineScript,
  createScriptTag,
  createStylesLinkTag,
  incrementStatistic,
  nullsLast,
  ordinal,
} from "@allurereport/core-api";
import {
  type AllureStore,
  type ReportFiles,
  type ResultFile,
  createTreeByCategories,
  createTreeByLabels,
  processTree,
} from "@allurereport/plugin-api";
import type {
  ClassicFixtureResult,
  ClassicReportOptions,
  ClassicTestResult,
  ClassicTreeGroup,
  ClassicTreeLeaf,
} from "@allurereport/web-classic";
import { getPieChartValues } from "@allurereport/web-commons";
import Handlebars from "handlebars";

import { matchCategories } from "./categories.js";
import { convertFixtureResult, convertTestResult } from "./converters.js";
import type { ClassicCategory, ClassicOptions, TemplateManifest } from "./model.js";
import type { ClassicDataWriter, ReportFile } from "./writer.js";

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
          "report": "classic",
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

const compiledTemplate = Handlebars.compile(template);

const writeConcurrently = async <T>(items: readonly T[], write: (item: T) => Promise<void>, concurrency = 64) => {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(write));
  }
};

export const readTemplateManifest = async (singleFileMode?: boolean): Promise<TemplateManifest> => {
  const templateManifestSource = require.resolve(
    `@allurereport/web-classic/dist/${singleFileMode ? "single" : "multi"}/manifest.json`,
  );
  const templateManifest = await readFile(templateManifestSource, { encoding: "utf-8" });

  return JSON.parse(templateManifest);
};

const createBreadcrumbs = (convertedTr: ClassicTestResult) => {
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

export const generateTestResults = async (writer: ClassicDataWriter, store: AllureStore) => {
  const allTr = await store.allTestResults({ includeRetries: true });
  const related = await store.relatedByTestResultIds(allTr.map(({ id }) => id));
  const categories: ClassicCategory[] = (await store.metadataByKey("allure2_categories")) ?? [];
  let convertedTrs: ClassicTestResult[] = [];

  for (const tr of allTr) {
    const trFixtures = related.fixturesByTrId.get(tr.id) ?? [];
    const convertedTrFixtures: ClassicFixtureResult[] = [...trFixtures]
      .sort(nullsLast(compareBy("start", ordinal())))
      .map(convertFixtureResult);
    const convertedTr: ClassicTestResult = convertTestResult(tr);
    const { error, status, flaky } = convertedTr;
    const matchedCategories = matchCategories(categories, {
      message: error?.message,
      trace: error?.trace,
      status,
      flaky,
    });

    convertedTr.categories = matchedCategories;
    convertedTr.history = related.historyByTrId.get(tr.id) ?? [];
    convertedTr.retries = related.retriesByTrId.get(tr.id) ?? [];
    convertedTr.retry = convertedTr.retries.length > 0;
    convertedTr.isRetry = tr.isRetry;
    convertedTr.setup = convertedTrFixtures.filter((f) => f.type === "before");
    convertedTr.teardown = convertedTrFixtures.filter((f) => f.type === "after");
    // FIXME: the type is correct, but typescript still shows an error
    // @ts-ignore
    convertedTr.attachments = (related.attachmentsByTrId.get(tr.id) ?? []).map((attachment) => ({
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

  await writeConcurrently(convertedTrs, (convertedTr) => writer.writeTestCase(convertedTr));

  await writer.writeWidget(
    "nav.json",
    convertedTrs.filter(({ isRetry }) => !isRetry).map(({ id }) => id),
  );

  return convertedTrs;
};

export const generateTree = async (
  writer: ClassicDataWriter,
  treeName: string,
  labels: string[],
  tests: ClassicTestResult[],
) => {
  const visibleTests = tests.filter((test) => !test.isRetry);
  const tree = createTreeByLabels<ClassicTestResult, ClassicTreeLeaf, ClassicTreeGroup>(
    visibleTests,
    labels,
    ({ id, name, status, duration, flaky, transition, start, retries }) => {
      const retriesCount = retries?.length ?? 0;

      return {
        nodeId: id,
        retry: Boolean(retriesCount),
        retriesCount,
        name,
        status,
        duration,
        flaky,
        transition,
        start,
      };
    },
    undefined,
    (group, leaf) => {
      incrementStatistic(group.statistic, leaf.status);
    },
  );

  processTree(tree, {
    sort: nullsLast(compareBy("start", ordinal())),
    transform: (leaf, idx) => ({ ...leaf, groupOrder: idx + 1 }),
  });

  await writer.writeWidget(`${treeName}.json`, tree);
};

export const generateEnvironmentJson = async (writer: ClassicDataWriter, env: EnvironmentItem[]) => {
  await writer.writeWidget("allure_environment.json", env);
};

export const generateStatistic = async (writer: ClassicDataWriter, statistic: Statistic) => {
  await writer.writeWidget("allure_statistic.json", statistic);
};

export const generatePieChart = async (writer: ClassicDataWriter, statistic: Statistic) => {
  const chartData = getPieChartValues(statistic);

  await writer.writeWidget("allure_pie_chart.json", chartData);
};

export const generateAttachmentsFiles = async (
  writer: ClassicDataWriter,
  attachmentLinks: AttachmentLink[],
  contentFunction: (id: string) => Promise<ResultFile | undefined>,
) => {
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

export const generateHistoryDataPoints = async (writer: ClassicDataWriter, store: AllureStore) => {
  const result = new Map<string, string>();
  const allHistoryPoints = await store.allHistoryDataPoints();

  for (const historyPoint of allHistoryPoints.slice(0, 6)) {
    const src = `history/${historyPoint.uuid}.json`;
    await writer.writeData(src, historyPoint);
  }
  return result;
};

const SINGLE_FILE_SIZE_WARNING_THRESHOLD = 50 * 1024 * 1024;

export const generateStaticFiles = async (
  payload: ClassicOptions & {
    allureVersion: string;
    reportFiles: ReportFiles;
    sharedAssetsFiles?: ReportFiles;
    unifiedStorage?: boolean;
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
    theme = "auto",
    groupBy,
    reportFiles,
    sharedAssetsFiles,
    reportDataFiles,
    reportUuid,
    allureVersion,
  } = payload;
  const manifest = await readTemplateManifest(payload.singleFile);
  const headTags: string[] = [];
  const bodyTags: string[] = [];
  const assetsTarget = sharedAssetsFiles ?? reportFiles;
  const assetsPrefix = sharedAssetsFiles ? "../_shared/" : "";

  if (!payload.singleFile) {
    for (const key in manifest) {
      const fileName = manifest[key];
      const filePath = require.resolve(
        join("@allurereport/web-classic/dist", singleFile ? "single" : "multi", fileName),
      );

      if (key.includes(".woff")) {
        headTags.push(createFontLinkTag(`${assetsPrefix}${fileName}`));
      }

      if (key === "main.css") {
        headTags.push(createStylesLinkTag(`${assetsPrefix}${fileName}`));
      }
      if (key === "main.js") {
        bodyTags.push(createScriptTag(`${assetsPrefix}${fileName}`));
      }

      if (singleFile) {
        continue;
      }

      const fileContent = await readFile(filePath);

      await assetsTarget.addFile(basename(filePath), fileContent);
    }
  } else {
    const mainJs = manifest["main.js"];
    const mainJsSource = require.resolve(`@allurereport/web-classic/dist/single/${mainJs}`);
    const mainJsContentBuffer = await readFile(mainJsSource);

    bodyTags.push(createScriptTag(`data:text/javascript;base64,${mainJsContentBuffer.toString("base64")}`));
  }

  const now = Date.now();
  const attachmentsBasePath = payload.unifiedStorage ? "../_shared/data/attachments" : undefined;
  const reportOptions: ClassicReportOptions = {
    reportName,
    logo,
    theme,
    reportLanguage,
    createdAt: now,
    reportUuid,
    groupBy: groupBy?.length ? groupBy : ["parentSuite", "suite", "subSuite"],
    allureVersion,
    cacheKey: now.toString(),
    attachmentsBasePath,
  };

  try {
    const html = compiledTemplate({
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

export const generateTreeByCategories = async (
  writer: ClassicDataWriter,
  treeName: string,
  tests: ClassicTestResult[],
) => {
  const visibleTests = tests.filter((test) => !test.isRetry);

  const tree = createTreeByCategories<ClassicTestResult, ClassicTreeLeaf, ClassicTreeGroup>(
    visibleTests,
    ({ id, name, status, duration, flaky, transition, start, retries }: ClassicTestResult) => {
      const retriesCount = retries?.length ?? 0;

      return {
        nodeId: id,
        retry: Boolean(retriesCount),
        retriesCount,
        name,
        status,
        duration,
        flaky,
        transition,
        start,
      };
    },
    undefined,
    (group: TreeGroup<ClassicTreeGroup>, leaf: TreeLeaf<ClassicTreeLeaf>) => {
      incrementStatistic(group.statistic, leaf.status);
    },
  );

  processTree(tree, {
    sort: nullsLast(compareBy("start", ordinal())),
    transform: (leaf: TreeLeaf<ClassicTreeLeaf>, idx: number) => ({
      ...leaf,
      groupOrder: idx + 1,
    }),
  });

  await writer.writeWidget(`${treeName}.json`, tree);
};
