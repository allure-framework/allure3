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
  makeTestResultNames,
} from "../utils/mocks.js";

const reportName = "Sample allure report";
const { name: ordinaryTestName, fullName: ordinaryTestFullname } = makeTestResultNames("ordinary test");
const testCaseId = makeTestCaseId(ordinaryTestFullname);
const { name: passedTestName, fullName: passedTestFullname } = makeTestResultNames("new passed test");
const { name: failedTestName, fullName: failedTestFullname } = makeTestResultNames("new failed test");

test.describe("new tests", () => {
  let bootstrap: ReportBootstrap;
  let treePage: TreePage;

  test.beforeAll(async () => {
    const ordinaryTestResult = makeTestResult({
      name: ordinaryTestName,
      fullName: ordinaryTestFullname,
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
      ordinaryTestResult,
    ];

    const history = makeHistory(6, () => ({
      name: reportName,
      knownTestCaseIds: [testCaseId],
      testResults: makeHistoryTestResults([ordinaryTestResult]),
    }));

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
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("should be able to filter new tests with using new filter", async ({ page }) => {
    await page.goto(bootstrap.url);

    await expect(treePage.leafLocator).toHaveCount(3);

    // Select filter by new status
    await treePage.toggleNewFilter();

    // Verify only tests with new status are visible
    await expect(treePage.leafLocator).toHaveCount(2);

    // Verify the test names are correct for tests with new status
    await expect(treePage.getLeafByTitle(passedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(failedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(ordinaryTestName)).not.toBeVisible();

    // Disable filter by new status
    await treePage.toggleNewFilter();

    // Verify all tests are visible again
    await expect(treePage.leafLocator).toHaveCount(3);
  });

  test("should show new icon only for new tests in the tree", async ({ page }) => {
    await page.goto(bootstrap.url);

    // Classic new test
    await expect(treePage.getLeafByTitle(passedTestName).getByTestId("tree-leaf-transition-new")).toBeVisible();
    await expect(treePage.getLeafByTitle(failedTestName).getByTestId("tree-leaf-transition-new")).toBeVisible();

    // Non-new test
    await expect(treePage.getLeafByTitle(ordinaryTestName).getByTestId("tree-leaf-transition-new")).not.toBeVisible();
  });

  test("metadata shows correct count of new tests", async ({ page }) => {
    await page.goto(bootstrap.url);

    const total = await treePage.getMetadataValue("total");
    const newCount = await treePage.getMetadataValue("new");

    expect(total).toBe("3");
    expect(newCount).toBe("2");
  });

  test("should apply new filter to the tree when filter=new query parameter is present", async ({ page }) => {
    await page.goto(`${bootstrap.url}?filter=new`);

    await expect(treePage.leafLocator).toHaveCount(2);

    await treePage.toggleNewFilter();

    await expect(treePage.leafLocator).toHaveCount(3);
  });
});
