import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;

test.describe("new tests", () => {
    test.beforeAll(async () => {
      const now = Date.now();

      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Sample allure report with new tests",
          appendHistory: false,
          history: [],
          historyPath: undefined,
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
          // Tests with retries
          {
            name: "Test with retries",
            fullName: "sample.js#Test with retries",
            historyId: "retryTest1",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: now + 4000,
            stop: now + 5000,
            statusDetails: {
              message: "Second attempt failed",
              trace: "Second attempt trace",
            },
          },
          {
            name: "Test with retries",
            fullName: "sample.js#Test with retries",
            historyId: "retryTest1",
            status: Status.PASSED,
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
