import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TreePage } from "../../pageObjects/index.js";
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

let bootstrap: ReportBootstrap;
let treePage: TreePage;

const reportName = "Sample allure report";

// Totally new test
const { name: newTestName, fullName: newTestFullname } = makeTestResultNames("new test");

// New status tests means that the test changed significant status (passed, failed, broken) to another significant one
// New FAILED test
const { name: newFailedTestName, fullName: newFailedTestFullname } = makeTestResultNames("new failed test");
const newFailedTestTestCaseId = makeTestCaseId(newFailedTestFullname);
const newFailedTestHistoryId = makeHistoryId(newFailedTestFullname);

// New PASSED test
const { name: newPassedTestName, fullName: newPassedTestFullname } = makeTestResultNames("new passed test");
const newPassedTestTestCaseId = makeTestCaseId(newPassedTestFullname);
const newPassedTestHistoryId = makeHistoryId(newPassedTestFullname);

// New BROKEN test
const { name: newBrokenTestName, fullName: newBrokenTestFullname } = makeTestResultNames("new broken test");
const newBrokenTestTestCaseId = makeTestCaseId(newBrokenTestFullname);
const newBrokenTestHistoryId = makeHistoryId(newBrokenTestFullname);

test.describe("status transitions", () => {
  test.beforeAll(async () => {
    const testResults = [
      makeTestResult({
        name: newTestName,
        fullName: newTestFullname,
        status: Status.PASSED,
        stage: Stage.FINISHED,
      }),
      makeTestResult({
        name: newPassedTestName,
        fullName: newPassedTestFullname,
        historyId: newPassedTestHistoryId,
        status: Status.PASSED,
        stage: Stage.FINISHED,
      }),
      makeTestResult({
        name: newFailedTestName,
        fullName: newFailedTestFullname,
        historyId: newFailedTestHistoryId,
        status: Status.FAILED,
        stage: Stage.FINISHED,
      }),
      makeTestResult({
        name: newBrokenTestName,
        fullName: newBrokenTestFullname,
        historyId: newBrokenTestHistoryId,
        status: Status.BROKEN,
        stage: Stage.FINISHED,
      }),
    ];

    const history = makeHistory(8, (index) => ({
      name: reportName,
      knownTestCaseIds: [newFailedTestTestCaseId, newPassedTestTestCaseId, newBrokenTestTestCaseId],
      testResults: makeHistoryTestResults([
        makeTestResult({
          name: newFailedTestName,
          fullName: newFailedTestFullname,
          status: index % 2 === 0 ? Status.PASSED : Status.SKIPPED,
          stage: Stage.FINISHED,
        }),
        makeTestResult({
          name: newPassedTestName,
          fullName: newPassedTestFullname,
          status: index % 3 === 0 ? Status.FAILED : Status.SKIPPED,
          stage: Stage.FINISHED,
        }),
        makeTestResult({
          name: newBrokenTestName,
          fullName: newBrokenTestFullname,
          status: index % 4 === 0 ? Status.FAILED : Status.SKIPPED,
          stage: Stage.FINISHED,
        }),
      ]),
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

    await page.goto(bootstrap.url);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("should be able to filter fixed tests with using freshely fixed status filter", async () => {
    await expect(treePage.leafLocator).toHaveCount(4);

    // Select freshely fixed filter
    await treePage.toggleFixedFilter();

    // Verify only tests with freshely new status are visible
    await expect(treePage.leafLocator).toHaveCount(1);

    // Verify the test names are correct for tests with freshely new status
    await expect(treePage.getLeafByTitle(newTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(newPassedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(newFailedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(newBrokenTestName)).not.toBeVisible();

    // Disable fixed filter
    await treePage.toggleFixedFilter();

    // Verify all tests are visible again
    await expect(treePage.leafLocator).toHaveCount(4);
  });

  test("should be able to filter regressed tests with using freshely regressed status filter", async () => {
    await expect(treePage.leafLocator).toHaveCount(4);

    // Select freshely fixed filter
    await treePage.toggleRegressedFilter();

    // Verify only tests with freshely regressed status are visible
    await expect(treePage.leafLocator).toHaveCount(1);

    // Verify the test names are correct for tests with freshely regressed status
    await expect(treePage.getLeafByTitle(newTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(newPassedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(newFailedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(newBrokenTestName)).not.toBeVisible();

    // Disable regressed filter
    await treePage.toggleRegressedFilter();

    // Verify all tests are visible again
    await expect(treePage.leafLocator).toHaveCount(4);
  });

  test("should be able to filter malfunctioned tests with using freshely malfunctioned status filter", async () => {
    await expect(treePage.leafLocator).toHaveCount(4);

    // Select freshely malfunctioned filter
    await treePage.toggleMalfuctionedFilter();

    // Verify only tests with freshely malfunctioned status are visible
    await expect(treePage.leafLocator).toHaveCount(1);

    // Verify the test names are correct for tests with freshely malfunctioned status
    await expect(treePage.getLeafByTitle(newTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(newPassedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(newFailedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(newBrokenTestName)).toBeVisible();

    // Disable malfunctioned filter
    await treePage.toggleMalfuctionedFilter();

    // Verify all tests are visible again
    await expect(treePage.leafLocator).toHaveCount(4);
  });
});
