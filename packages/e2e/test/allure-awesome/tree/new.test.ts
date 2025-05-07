import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeHistoryId, makeTestCaseId } from "../../utils/index.js";

let bootstrap: ReportBootstrap;

test.describe("new tests", () => {
    test.beforeAll(async () => {
      const now = Date.now();

      const reportName = "Sample allure report with new tests";
      const flakyTestName = "Test with history";
      const flakyTestFullname = "sample.js#Test with history";
      const testCaseId = makeTestCaseId(flakyTestFullname);
      const historyId = makeHistoryId("Test with history");

      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Sample allure report with new tests",
          appendHistory: true,
          history: [
            {
                uuid: "dc4d9432-ebef-4e0f-b121-37fcf0383023",
                name: reportName,
                timestamp: 1745926867897,
                knownTestCaseIds: [testCaseId],
                testResults: {
                  [historyId]: {
                    id: "42dffbf3bb12f89807c85206c3f993a2",
                    name: flakyTestName,
                    fullName: flakyTestFullname,
                    status: Status.PASSED,
                    start: 1745926873782,
                    stop: 1745926874782,
                    duration: 1000,
                    labels: [],
                  },
                },
                metrics: {},
              },
              {
                uuid: "b441fbc8-5222-4380-a325-d776436789f3",
                name: reportName,
                timestamp: 1745926884436,
                knownTestCaseIds: [testCaseId],
                testResults: {
                  [historyId]: {
                    id: "1373936b78555e2d7646b6f7eccb5b83",
                    name: flakyTestName,
                    fullName: flakyTestFullname,
                    status: Status.PASSED,
                    start: 1745926890322,
                    stop: 1745926891322,
                    duration: 1000,
                    labels: [],
                  },
                },
                metrics: {},
              },
          ],
          historyPath: "history.jsonl",
          knownIssuesPath: undefined,
        },
        testResults: [
          {
            name: "New PASSED test 1",
            fullName: "sample.js#New test 1",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: now,
            stop: now + 1000,
          },
          {
            name: "New FAILED test 2",
            fullName: "sample.js#New test 2",
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
        await expect(page.getByText("Test with retries", { exact: true })).toBeVisible();
        await expect(page.getByText("Another test with retries", { exact: true })).toBeVisible();
        await expect(page.getByText("Test without retries", { exact: true })).not.toBeVisible();

        // Disable retry filter
        await page.getByTestId("new-filter").click();

        // Verify all tests are visible again
        await expect(page.getByTestId("tree-leaf")).toHaveCount(3);
      });
});
