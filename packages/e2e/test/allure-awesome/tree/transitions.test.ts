import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import {
  makeHistory,
  makeHistoryTestResults,
  makeReportConfig,
  makeTestCaseId,
  makeHistoryId,
  makeTestResult,
} from "../utils/mocks.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;

const reportName = "Sample allure report";

// Totally new test
const newTestName = "New test 1";
const newTestFullname = "sample.js#New test 1";

// New status tests means that the test changed meaningful status (passed, failed, broken) to another meaningful one
// New FAILED test
const newFailedTestName = "New FAILED test";
const newFailedTestFullname = "sample.js#New FAILED test";
const newFailedTestTestCaseId = makeTestCaseId(newFailedTestFullname);
const newFailedTestHistoryId = makeHistoryId(newFailedTestFullname);

// New PASSED test
const newPassedTestName = "New PASSED test";
const newPassedTestFullname = "sample.js#New PASSED test";
const newPassedTestTestCaseId = makeTestCaseId(newPassedTestFullname);
const newPassedTestHistoryId = makeHistoryId(newPassedTestFullname);

// New BROKEN test
const newBrokenTestName = "New BROKEN test";
const newBrokenTestFullname = "sample.js#New BROKEN test";
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

    const history = makeHistory(6, () => ({
      name: reportName,
      knownTestCaseIds: [newFailedTestTestCaseId, newPassedTestTestCaseId, newBrokenTestTestCaseId],
      testResults: makeHistoryTestResults([
        makeTestResult({
          name: newFailedTestName,
          fullName: newFailedTestFullname,
          status: Status.PASSED,
          stage: Stage.FINISHED,
        }),
        makeTestResult({
          name: newPassedTestName,
          fullName: newPassedTestFullname,
          status: Status.FAILED,
          stage: Stage.FINISHED,
        }),
        makeTestResult({
          name: newBrokenTestName,
          fullName: newBrokenTestFullname,
          status: Status.FAILED,
          stage: Stage.FINISHED,
        }),
      ]),
    }));

    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: reportName,
        history,
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
