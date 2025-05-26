import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { makeHistoryId, makeTestCaseId } from "../../utils/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;

const reportName = "Sample allure report";
const flakyTestName = "Test with history";
const flakyTestFullname = "sample.js#Test with history";
const testCaseId = makeTestCaseId(flakyTestFullname);
const historyId = makeHistoryId(flakyTestFullname);

const passedTestName = "New PASSED test 1";
const passedTestFullname = "sample.js#New PASSED test 1";

const failedTestName = "New FAILED test 2";
const failedTestFullname = "sample.js#New FAILED test 2";

test.describe("new tests", () => {
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
            uuid: "773a702e-d63c-4628-b9f1-49a14d509e06",
            name: reportName,
            timestamp: 1746612096098,
            knownTestCaseIds: [testCaseId],
            testResults: {
              [historyId]: {
                id: "942fae5dbc02b4c8e0230c068e6d31ec",
                name: flakyTestName,
                fullName: flakyTestFullname,
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
            uuid: "da5f9e79-c170-4150-a071-e2f5e6213e6f",
            name: reportName,
            timestamp: 1746612147646,
            knownTestCaseIds: [testCaseId],
            testResults: {
              [historyId]: {
                id: "f12c65cdb5c6fdedcd93797b303bf815",
                name: flakyTestName,
                fullName: flakyTestFullname,
                status: Status.FAILED,
                start: 1746612151561,
                stop: 1746612152561,
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
          name: passedTestName,
          fullName: passedTestFullname,
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now,
          stop: now + 1000,
        },
        {
          name: failedTestName,
          fullName: failedTestFullname,
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now + 2000,
          stop: now + 3000,
        },
        // Test with history
        {
          name: flakyTestName,
          fullName: flakyTestFullname,
          historyId,
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now + 4000,
          stop: now + 5000,
          statusDetails: {
            message: "Second attempt failed",
            trace: "Second attempt trace",
          },
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

  test("should be able to filter new tests with using new filter", async ({ page }) => {
    await expect(page.getByTestId("tree-leaf")).toHaveCount(3);

    // Open filters
    await page.getByTestId("filters-button").click();

    // Select retry filter
    await page.getByTestId("new-filter").click();

    // Verify only tests with retries are visible
    const treeLeaves = page.getByTestId("tree-leaf");
    await expect(treeLeaves).toHaveCount(2);

    // Verify the test names are correct for tests with retries
    await expect(page.getByText(passedTestName, { exact: true })).toBeVisible();
    await expect(page.getByText(failedTestName, { exact: true })).toBeVisible();
    await expect(page.getByText(flakyTestName, { exact: true })).not.toBeVisible();

    // Disable retry filter
    await page.getByTestId("new-filter").click();

    // Verify all tests are visible again
    await expect(page.getByTestId("tree-leaf")).toHaveCount(3);
  });

  test("should show new icon only for new tests in the tree", async ({ page }) => {
    const treeLeaves = page.getByTestId("tree-leaf");

    // Classic new test
    const passedNewTest = treeLeaves
      .filter({ has: page.getByText(passedTestName, { exact: true }) })
      .getByTestId("tree-leaf-transition-new");
    await expect(passedNewTest).toBeVisible();

    const failedNewTest = treeLeaves
      .filter({ has: page.getByText(failedTestName, { exact: true }) })
      .getByTestId("tree-leaf-transition-new");
    await expect(failedNewTest).toBeVisible();

    // Non-new test
    const nonNew = treeLeaves
      .filter({ has: page.getByText(flakyTestName, { exact: true }) })
      .getByTestId("tree-leaf-transition-new");
    await expect(nonNew).not.toBeVisible();
  });

  test("metadata shows correct count of new tests", async ({ page }) => {
    await expect(page.getByTestId("metadata-item-total").getByTestId("metadata-value")).toHaveText("3");
    await expect(page.getByTestId("metadata-item-new").getByTestId("metadata-value")).toHaveText("2");
  });
});
