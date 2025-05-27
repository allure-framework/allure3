import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { makeHistoryId, makeTestCaseId } from "../../utils/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import crypto from "crypto";

let bootstrap: ReportBootstrap;

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

const getRandomUUID = () => {
  return crypto.randomUUID();
};

test.describe("status transitions", () => {
  test.beforeAll(async () => {
    const now = Date.now();

    bootstrap = await bootstrapReport({
      reportConfig: {
        name: reportName,
        appendHistory: true,
        historyPath: "history.jsonl",
        knownIssuesPath: undefined,
        history: [
          {
            uuid: getRandomUUID(),
            name: reportName,
            timestamp: 1746612096098,
            knownTestCaseIds: [newFailedTestTestCaseId, newPassedTestTestCaseId, newBrokenTestTestCaseId],
            testResults: {
              [newFailedTestHistoryId]: {
                id: getRandomUUID(),
                name: newFailedTestName,
                fullName: newFailedTestFullname,
                status: Status.PASSED,
                start: 1746612100009,
                stop: 1746612101009,
                duration: 1000,
                labels: [],
              },
              [newPassedTestHistoryId]: {
                id: getRandomUUID(),
                name: newPassedTestName,
                fullName: newPassedTestFullname,
                status: Status.FAILED,
                start: 1746612100009,
                stop: 1746612101009,
                duration: 1000,
                labels: [],
              },
              [newBrokenTestHistoryId]: {
                id: getRandomUUID(),
                name: newBrokenTestName,
                fullName: newBrokenTestFullname,
                status: Status.FAILED,
                start: 1746612100009,
                stop: 1746612101009,
                duration: 1000,
                labels: [],
              },
            },
            metrics: {},
          },
          {
            uuid: getRandomUUID(),
            name: reportName,
            timestamp: 1746612147646,
            knownTestCaseIds: [newFailedTestTestCaseId, newPassedTestTestCaseId, newBrokenTestTestCaseId],
            testResults: {
              [newFailedTestHistoryId]: {
                id: getRandomUUID(),
                name: newFailedTestName,
                fullName: newFailedTestFullname,
                status: Status.PASSED,
                start: 1746612100009,
                stop: 1746612101009,
                    duration: 1000,
                    labels: [],
                  },
              [newPassedTestHistoryId]: {
                id: getRandomUUID(),
                name: newPassedTestName,
                fullName: newPassedTestFullname,
                status: Status.FAILED,
                start: 1746612100009,
                stop: 1746612101009,
                    duration: 1000,
                    labels: [],
                  },
              [newBrokenTestHistoryId]: {
                id: getRandomUUID(),
                name: newBrokenTestName,
                fullName: newBrokenTestFullname,
                status: Status.FAILED,
                start: 1746612100009,
                stop: 1746612101009,
                duration: 1000,
                    labels: [],
                  },
            },
            metrics: {},
          },
        ],
      },
      testResults: [
        {
          name: newTestName,
          fullName: newTestFullname,
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now,
          stop: now + 1000,
        },
        {
          name: newPassedTestName,
          fullName: newPassedTestFullname,
          historyId: newPassedTestHistoryId,
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now + 2000,
          stop: now + 3000,
        },
        {
          name: newFailedTestName,
          fullName: newFailedTestFullname,
          historyId: newFailedTestHistoryId,
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now + 4000,
          stop: now + 5000,
        },
        {
          name: newBrokenTestName,
          fullName: newBrokenTestFullname,
          historyId: newBrokenTestHistoryId,
          status: Status.BROKEN,
          stage: Stage.FINISHED,
          start: now + 6000,
          stop: now + 7000,
        },
      ],
    });
  });

  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);
    await page.goto(bootstrap.url);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("should be able to filter new tests with using freshely new status filter", async ({ page }) => {
    await expect(page.getByTestId("tree-leaf")).toHaveCount(4);

    // Open filters
    await page.getByTestId("filters-button").click();

    // Select new filter
    await page.getByTestId("new-filter").click();

    // Verify only tests with freshely new status are visible
    const treeLeaves = page.getByTestId("tree-leaf");
    await expect(treeLeaves).toHaveCount(1);

    // Verify the test names are correct for tests with freshely new status
    await expect(page.getByText(newTestName, { exact: true })).toBeVisible();
    await expect(page.getByText(newPassedTestName, { exact: true })).not.toBeVisible();
    await expect(page.getByText(newFailedTestName, { exact: true })).not.toBeVisible();
    await expect(page.getByText(newBrokenTestName, { exact: true })).not.toBeVisible();

    // Disable new filter
    await page.getByTestId("new-filter").click();

    // Verify all tests are visible again
    await expect(page.getByTestId("tree-leaf")).toHaveCount(4);
  });

  /* test("should show new icon only for new tests in the tree", async ({ page }) => {
    const treeLeaves = page.getByTestId("tree-leaf");

    // Classic new test
    const passedNewTest = treeLeaves
      .filter({ has: page.getByText(passedTestName, { exact: true }) })
      .getByTestId("tree-item-meta-icon-new");
    await expect(passedNewTest).toBeVisible();

    const failedNewTest = treeLeaves
      .filter({ has: page.getByText(failedTestName, { exact: true }) })
      .getByTestId("tree-item-meta-icon-new");
    await expect(failedNewTest).toBeVisible();

    // Non-new test
    const nonNew = treeLeaves
      .filter({ has: page.getByText(flakyTestName, { exact: true }) })
      .getByTestId("tree-item-meta-icon-new");
    await expect(nonNew).not.toBeVisible();
  });

  test("metadata shows correct count of new tests", async ({ page }) => {
    await expect(page.getByTestId("metadata-item-total").getByTestId("metadata-value")).toHaveText("3");
    await expect(page.getByTestId("metadata-item-new").getByTestId("metadata-value")).toHaveText("2");
  });*/
});
