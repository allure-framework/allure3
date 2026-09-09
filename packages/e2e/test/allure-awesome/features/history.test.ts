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

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test.describe("without history", () => {
    test.beforeAll(async () => {
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

  test.describe("with remote history", () => {
    const historicalResultId = "7d99d8872696437419752cf967fe6592";

    test.beforeAll(async () => {
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

      const expectedUrl = `${fixtures.url}/awesome#${historicalResultId}`;
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
});
