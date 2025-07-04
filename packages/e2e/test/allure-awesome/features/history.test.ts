import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { makeHistory, makeHistoryId, makeHistoryTestResults, makeReportConfig, makeTestCaseId, makeTestResult, makeTestResultNames } from "../utils/mocks.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

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

test.beforeEach(async ({ browserName, page }) => {
  await label("env", browserName);

  treePage = new TreePage(page);
  testResultPage = new TestResultPage(page);

  await page.goto(bootstrap.url);
});

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test.describe("history", () => {
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
    test.beforeAll(async () => {
      bootstrap = await bootstrapReport({
        reportConfig: { ...fixtures.reportConfig },
        history: [
          {
            ...fixtures.history[0],
            url: fixtures.url,
            testResults: {
              [historyId]: {
                ...fixtures.history[0].testResults[0],
                url: fixtures.url,
              },
            },
          },
        ],
        testResults: [...fixtures.testResults],
      });
    });

    test("should show history for the test result", async ({ page }) => {
      await treePage.clickNthLeaf(0);
      await testResultPage.historyTabLocator.click();

      await page.pause();

      await expect(testResultPage.historyItemLocator).toHaveCount(1);
      await expect(testResultPage.prevStatusLocator).toHaveCount(1);
    });
  });
});
