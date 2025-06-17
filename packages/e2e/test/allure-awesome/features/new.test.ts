import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import {
  makeHistory,
  makeHistoryTestResults,
  makeReportConfig,
  makeTestCaseId,
  makeTestResult,
} from "../utils/mocks.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;

const reportName = "Sample allure report";
const flakyTestName = "Test with history";
const flakyTestFullname = "sample.js#Test with history";
const testCaseId = makeTestCaseId(flakyTestFullname);

const passedTestName = "New PASSED test 1";
const passedTestFullname = "sample.js#New PASSED test 1";

const failedTestName = "New FAILED test 2";
const failedTestFullname = "sample.js#New FAILED test 2";

test.describe("new tests", () => {
  test.beforeAll(async () => {
    const flakyTestResult = makeTestResult({
      name: flakyTestName,
      fullName: flakyTestFullname,
      status: Status.FAILED,
      stage: Stage.FINISHED,
    });

    const testResults = [
      makeTestResult({
        name: passedTestName,
        fullName: passedTestFullname,
        status: Status.PASSED,
        stage: Stage.FINISHED,
      }),
      makeTestResult({
        name: failedTestName,
        fullName: failedTestFullname,
        status: Status.FAILED,
        stage: Stage.FINISHED,
      }),
      flakyTestResult,
    ];

    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: reportName,
        history: makeHistory(6, () => ({
          name: reportName,
          knownTestCaseIds: [testCaseId],
          testResults: makeHistoryTestResults([flakyTestResult]),
        })),
      }),
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

  test("should be able to filter new tests with using new filter", async () => {
    await expect(treePage.leafLocator).toHaveCount(3);

    // Select filter by new status
    await treePage.toggleNewFilter();

    // Verify only tests with new status are visible
    await expect(treePage.leafLocator).toHaveCount(2);

    // Verify the test names are correct for tests with new status
    await expect(treePage.getLeafByTitle(passedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(failedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(flakyTestName)).not.toBeVisible();

    // Disable filter by new status
    await treePage.toggleNewFilter();

    // Verify all tests are visible again
    await expect(treePage.leafLocator).toHaveCount(3);
  });

  test("should show new icon only for new tests in the tree", async () => {
    // Classic new test
    await expect(treePage.getLeafByTitle(passedTestName).getByTestId("tree-leaf-transition-new")).toBeVisible();
    await expect(treePage.getLeafByTitle(failedTestName).getByTestId("tree-leaf-transition-new")).toBeVisible();

    // Non-new test
    await expect(treePage.getLeafByTitle(flakyTestName).getByTestId("tree-leaf-transition-new")).not.toBeVisible();
  });

  test("metadata shows correct count of new tests", async () => {
    const total = await treePage.getMetadataValue("total");
    const newCount = await treePage.getMetadataValue("new");

    expect(total).toBe("3");
    expect(newCount).toBe("2");
  });
});
