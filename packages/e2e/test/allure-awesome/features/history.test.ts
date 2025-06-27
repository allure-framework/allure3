import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { makeHistoryId, makeTestCaseId } from "../utils/mocks.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

const now = Date.now();
const reportName = "Allure report with history";
const testName = "sample test";
const fullName = `sample.js#${testName}`;
const testCaseId = makeTestCaseId(fullName);
const historyId = makeHistoryId(fullName);
const fixtures = {
  url: "http://allurereport.org/report/1",
  reportConfig: {
    name: reportName,
    appendHistory: true,
    knownIssuesPath: undefined,
  },
  history: [
    {
      uuid: "dc4d9432-ebef-4e0f-b121-37fcf0383023",
      name: reportName,
      timestamp: now + 1000,
      knownTestCaseIds: [testCaseId],
      url: "",
      testResults: {
        [historyId]: {
          id: "b40702a85e54a2f8dcc6cfdf791170dd",
          name: testName,
          status: Status.PASSED,
          start: now,
          stop: now + 1000,
          duration: 1000,
          labels: [],
          url: "",
          fullName,
        },
      },
      metrics: {},
    },
  ],
  testResults: [
    {
      name: testName,
      status: Status.PASSED,
      stage: Stage.FINISHED,
      start: now + 4000,
      stop: now + 5000,
      duration: 1000,
      fullName,
      historyId,
    },
  ],
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
