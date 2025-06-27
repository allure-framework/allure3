import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import {
  makeTestCaseId,
  makeHistoryId,
  makeTestResult,
  makeHistory,
  makeHistoryTestResults,
  makeReportConfig,
  makeTestResults,
} from "../utils/mocks.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;

const reportName = "Sample allure report with flaky tests";
const flakyTestName = "Classic flaky test";
const flakyTestFullname = "sample.js#Classic flaky test";
const flakyTestCaseId = makeTestCaseId(flakyTestFullname);
const flakyHistoryId = makeHistoryId(flakyTestFullname);

const nonFlakyTestName = "Non-flaky test";
const nonFlakyTestFullname = "sample.js#Non-flaky test";
const nonFlakyTestCaseId = makeTestCaseId(nonFlakyTestFullname);
const nonFlakyHistoryId = makeHistoryId(nonFlakyTestFullname);

test.describe("flaky", () => {
  test.beforeAll(async () => {
    const historyItemsCount = 6;
    // History: flaky: FAILED -> PASSED -> Rest is in FAILED state
    const flakyHistoryResults = makeTestResults(historyItemsCount, (index) => {
      if (index === 1) {
        return {
          name: flakyTestName,
          fullName: flakyTestFullname,
          status: Status.PASSED,
          stage: Stage.FINISHED,
        };
      }

      return {
        name: flakyTestName,
        fullName: flakyTestFullname,
        status: Status.FAILED,
        stage: Stage.FINISHED,
      };
    });

    // History: non-flaky: just always PASSED
    const nonFlakyHistoryResults = makeTestResults(historyItemsCount, () => ({
      name: nonFlakyTestName,
      fullName: nonFlakyTestFullname,
      status: Status.PASSED,
      stage: Stage.FINISHED,
    }));

    const history = makeHistory(historyItemsCount, (index) => ({
      name: reportName,
      knownTestCaseIds: [flakyTestCaseId, nonFlakyTestCaseId],
      testResults: {
        ...makeHistoryTestResults([flakyHistoryResults[index]]),
        ...makeHistoryTestResults([nonFlakyHistoryResults[index]]),
      },
    }));

    // Current results: flaky (FAILED), non-flaky (PASSED)
    const testResults = [
      makeTestResult({
        name: flakyTestName,
        fullName: flakyTestFullname,
        historyId: flakyHistoryId,
        status: Status.FAILED,
        stage: Stage.FINISHED,
      }),
      makeTestResult({
        name: nonFlakyTestName,
        fullName: nonFlakyTestFullname,
        historyId: nonFlakyHistoryId,
        status: Status.PASSED,
        stage: Stage.FINISHED,
      }),
    ];

    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: reportName,
      }),
      history,
      testResults,
    });
  });

  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);

    treePage = new TreePage(page);

    await page.goto(bootstrap.url);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("should be able to filter flaky tests with flaky status using flaky filter", async () => {
    await expect(treePage.leafLocator).toHaveCount(2);
    await treePage.toggleFlakyFilter();
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getLeafByTitle("Classic flaky test")).toBeVisible();
    await expect(treePage.getLeafByTitle("Non-flaky test")).not.toBeVisible();
    await treePage.toggleFlakyFilter();
    await expect(treePage.leafLocator).toHaveCount(2);
  });

  test("should show flaky icon only for flaky tests in the tree", async () => {
    await expect(treePage.getLeafByTitle("Classic flaky test").getByTestId("tree-leaf-flaky")).toBeVisible();
    await expect(treePage.getLeafByTitle("Non-flaky test").getByTestId("tree-leaf-flaky")).not.toBeVisible();
  });

  test("metadata shows correct count of flaky tests", async () => {
    const total = await treePage.getMetadataValue("total");
    const flaky = await treePage.getMetadataValue("flaky");

    expect(total).toBe("2");
    expect(flaky).toBe("1");
  });
});
