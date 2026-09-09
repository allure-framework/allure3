import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import type { HistoryDataPoint } from "@allurereport/core-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { epic, feature, label, Stage, Status, story } from "allure-js-commons";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import {
  makeHistory,
  makeHistoryId,
  makeHistoryTestResults,
  makeReportConfig,
  makeTestCaseId,
  makeTestResult,
  makeTestResultNames,
} from "../utils/mocks.js";

const reportName = "Allure report with history";
const { name: testName, fullName } = makeTestResultNames("sample test");
const testCaseId = makeTestCaseId(fullName);
const historyId = makeHistoryId(fullName);
const testResult = makeTestResult({
  name: testName,
  fullName,
  status: Status.PASSED,
  stage: Stage.FINISHED,
  historyId,
});
const history = makeHistory(1, () => ({
  name: reportName,
  knownTestCaseIds: [testCaseId],
  testResults: makeHistoryTestResults([testResult]),
}));
const fixtures = {
  url: "http://allurereport.org/report/1",
  reportConfig: makeReportConfig({
    name: reportName,
  }),
  history,
  testResults: [testResult],
};

test.describe("history", () => {
  let bootstrap: ReportBootstrap;
  let multiBootstrap: ReportBootstrap;
  let treePage: TreePage;
  let testResultPage: TestResultPage;

  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);
    await epic("coverage");
    await feature("history");
    await story("history");
    await label("coverage", "history");
    treePage = new TreePage(page);
    testResultPage = new TestResultPage(page);

    await page.goto(bootstrap.url);
  });

  const sequentialHistoryPath = resolve(tmpdir(), `allure-history-${randomUUID()}.jsonl`);

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
    await multiBootstrap?.shutdown?.();
    await rm(sequentialHistoryPath, { force: true });
  });

  test.describe("without history", () => {
    test.beforeAll(async () => {
      await bootstrap?.shutdown?.();
      bootstrap = await bootstrapReport({
        reportConfig: { ...fixtures.reportConfig },
        testResults: [...fixtures.testResults],
      });
    });

    test("should not show history for the test result", async () => {
      await treePage.clickNthLeaf(0);
      await testResultPage.historyTabLocator.click();

      await expect(testResultPage.historyItemLocator).toHaveCount(0);
      await expect(testResultPage.prevStatusLocator).toHaveCount(0);
    });
  });

  test.describe("with local history", () => {
    test.beforeAll(async () => {
      await bootstrap?.shutdown?.();
      bootstrap = await bootstrapReport({
        reportConfig: { ...fixtures.reportConfig },
        history: [...fixtures.history],
        testResults: [...fixtures.testResults],
      });
    });

    test("should show history for the test result, but without links", async () => {
      await treePage.clickNthLeaf(0);
      await testResultPage.historyTabLocator.click();

      await expect(testResultPage.historyItemLocator).toHaveCount(1);
      await expect(testResultPage.prevStatusLocator).toHaveCount(1);

      await expect(testResultPage.historyItemLocator.nth(0).getByRole("link")).not.toBeVisible();
      await expect(testResultPage.prevStatusLocator.nth(0).getByRole("link")).not.toBeVisible();
    });
  });

  test.describe("with local history containing an exact report URL", () => {
    const historicalResultId = "7d99d8872696437419752cf967fe6592";

    test.beforeAll(async () => {
      await bootstrap?.shutdown?.();
      bootstrap = await bootstrapReport({
        reportConfig: { ...fixtures.reportConfig },
        history: [
          {
            ...fixtures.history[0],
            url: fixtures.url,
            testResults: {
              ...fixtures.history[0].testResults,
              [historyId]: {
                ...fixtures.history[0].testResults[historyId],
                id: historicalResultId,
              },
            },
          },
        ],
        testResults: [...fixtures.testResults],
      });
    });

    test("should use the generated destination in both history views", async () => {
      await treePage.clickNthLeaf(0);
      await testResultPage.historyTabLocator.click();

      const expectedUrl = `${fixtures.url}#${historicalResultId}`;
      const historyLinks = testResultPage.historyItemLocator.nth(0).getByRole("link");
      const previousLink = testResultPage.prevStatusLocator.nth(0).getByRole("link");

      await expect(testResultPage.historyItemLocator).toHaveCount(1);
      await expect(testResultPage.prevStatusLocator).toHaveCount(1);
      await expect(historyLinks).toHaveCount(2);
      await expect(historyLinks.nth(0)).toBeVisible();
      await expect(historyLinks.nth(1)).toBeVisible();
      await expect(historyLinks.nth(0)).toHaveAttribute("href", expectedUrl);
      await expect(historyLinks.nth(1)).toHaveAttribute("href", expectedUrl);
      await expect(historyLinks.nth(1)).toHaveAttribute("target", "_blank");
      await expect(previousLink).toHaveCount(1);
      await expect(previousLink).toBeVisible();
      await expect(previousLink).toHaveAttribute("href", expectedUrl);
    });
  });

  test.describe("with sequential flattened and multi-report generations", () => {
    const flatBase = "https://bucket.example/runs/flat";
    const multiBase = "https://bucket.example/runs/multi";
    const finalBase = "https://bucket.example/runs/final";
    const flatResultId = "flat-result";
    const multiResultId = "multi-result";
    const finalResultId = "final-result";
    const results = [flatResultId, multiResultId, finalResultId].map((uuid, index) =>
      makeTestResult({
        name: testName,
        fullName,
        historyId,
        uuid,
        status: index === 1 ? Status.FAILED : Status.PASSED,
        stage: Stage.FINISHED,
        start: 1_000 + index * 1_000,
        stop: 1_500 + index * 1_000,
      }),
    );

    test.beforeAll(async () => {
      await bootstrap?.shutdown?.();

      const first = await bootstrapReport(
        {
          reportConfig: { ...fixtures.reportConfig, historyUrlBase: flatBase },
          historyPath: sequentialHistoryPath,
          testResults: [results[0]],
        },
        { singleFile: true },
      );
      await first.shutdown?.();

      multiBootstrap = await bootstrapReport({
        reportConfig: { ...fixtures.reportConfig, historyUrlBase: multiBase },
        historyPath: sequentialHistoryPath,
        testResults: [results[1]],
        additionalPlugins: [
          {
            id: "secondary",
            enabled: true,
            plugin: new AwesomePlugin(),
            options: {},
          },
        ],
      });

      bootstrap = await bootstrapReport(
        {
          reportConfig: { ...fixtures.reportConfig, historyUrlBase: finalBase },
          historyPath: sequentialHistoryPath,
          testResults: [results[2]],
        },
        { singleFile: true },
      );
    });

    test("should persist exact URLs and render historical links without duplication", async ({ page }) => {
      const historyDataPoints = (await readFile(sequentialHistoryPath, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as HistoryDataPoint);
      const flatDataPoint = historyDataPoints.find(({ url }) => url === `${flatBase}/index.html`);
      const multiDataPoint = historyDataPoints.find(({ url }) => url === `${multiBase}/`);
      const finalDataPoint = historyDataPoints.find(({ url }) => url === `${finalBase}/index.html`);
      const [flatHistoryResult] = Object.values(flatDataPoint?.testResults ?? {});
      const [multiHistoryResult] = Object.values(multiDataPoint?.testResults ?? {});
      const [finalHistoryResult] = Object.values(finalDataPoint?.testResults ?? {});

      expect(flatHistoryResult).toBeDefined();
      expect(multiHistoryResult).toBeDefined();
      expect(finalHistoryResult).toBeDefined();
      expect(flatHistoryResult?.url).toBe(`${flatBase}/index.html`);
      expect(multiHistoryResult?.url).toBe(`${multiBase}/`);
      expect(finalHistoryResult?.url).toBe(`${finalBase}/index.html`);
      expect(new Set([flatHistoryResult?.id, multiHistoryResult?.id, finalHistoryResult?.id]).size).toBe(3);

      const flatHistoryLink = `${flatHistoryResult?.url}#${flatHistoryResult?.id}`;
      const multiHistoryLink = `${multiHistoryResult?.url}awesome/index.html#${multiHistoryResult?.id}`;

      await page.goto(`${multiBootstrap.url}/awesome/index.html`);
      await treePage.clickNthLeaf(0);
      await testResultPage.historyTabLocator.click();

      await expect(testResultPage.historyItemLocator).toHaveCount(1);
      const multiReportHistoryLinks = testResultPage.historyItemLocator.nth(0).getByRole("link");
      const multiReportPreviousLink = testResultPage.prevStatusLocator.nth(0).getByRole("link");

      await expect(multiReportHistoryLinks).toHaveCount(2);
      await expect(multiReportHistoryLinks.nth(0)).toHaveAttribute("href", flatHistoryLink);
      await expect(multiReportHistoryLinks.nth(1)).toHaveAttribute("href", flatHistoryLink);
      await expect(multiReportPreviousLink).toHaveAttribute("href", flatHistoryLink);

      await page.goto(bootstrap.url);
      await treePage.clickNthLeaf(0);
      await testResultPage.historyTabLocator.click();

      await expect(testResultPage.historyItemLocator).toHaveCount(2);
      const historyLinks = testResultPage.historyItemLocator.getByRole("link");
      const hrefs = await historyLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")));

      expect(new Set(hrefs)).toEqual(new Set([flatHistoryLink, multiHistoryLink]));

      const previousLink = testResultPage.prevStatusLocator.nth(0).getByRole("link");

      await expect(previousLink).toHaveAttribute("href", multiHistoryLink);
    });
  });
});
