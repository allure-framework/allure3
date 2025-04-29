import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;

test.describe("retries", () => {
  test.beforeAll(async () => {
    const now = Date.now();

    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report with retries",
        appendHistory: false,
        history: undefined,
        historyPath: undefined,
        knownIssuesPath: undefined,
      },
      testResults: [
        // Test with retries (same historyId)
        {
          name: "Test with retries",
          fullName: "sample.js#Test with retries",
          historyId: "retryTest1",
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now,
          stop: now + 1000,
          statusDetails: {
            message: "First attempt failed",
            trace: "First attempt trace",
          },
        },
        {
          name: "Test with retries",
          fullName: "sample.js#Test with retries",
          historyId: "retryTest1",
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now + 2000,
          stop: now + 3000,
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
          start: now + 4000,
          stop: now + 5000,
        },
        // Another test with retries
        {
          name: "Another test with retries",
          fullName: "sample.js#Another test with retries",
          historyId: "retryTest2",
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now + 6000,
          stop: now + 7000,
          statusDetails: {
            message: "First attempt failed",
            trace: "First attempt trace",
          },
        },
        {
          name: "Another test with retries",
          fullName: "sample.js#Another test with retries",
          historyId: "retryTest2",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now + 8000,
          stop: now + 9000,
        },
        // Test without retries
        {
          name: "Test without retries",
          fullName: "sample.js#Test without retries",
          historyId: "nonRetryTest",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now + 10000,
          stop: now + 11000,
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

  test("should be able to filter tests with retries using retry filter", async ({ page }) => {
    await expect(page.getByTestId("tree-leaf")).toHaveCount(3);

    // Open filters
    await page.getByTestId("filters-button").click();

    // Select retry filter
    await page.getByTestId("retry-filter").click();

    // Verify only tests with retries are visible
    const treeLeaves = page.getByTestId("tree-leaf");
    await expect(treeLeaves).toHaveCount(2);

    // Verify the test names are correct for tests with retries
    await expect(page.getByText("Test with retries", { exact: true })).toBeVisible();
    await expect(page.getByText("Another test with retries", { exact: true })).toBeVisible();
    await expect(page.getByText("Test without retries", { exact: true })).not.toBeVisible();

    // Disable retry filter
    await page.getByTestId("retry-filter").click();

    // Verify all tests are visible again
    await expect(page.getByTestId("tree-leaf")).toHaveCount(3);
  });

  test("should show retry icon in the tree for tests with retries", async ({ page }) => {
    // Check that retry icons are visible for tests with retries
    const retryIcons = page.getByTestId("tree-item-retries");
    await expect(retryIcons).toHaveCount(2);

    // Check retry count indicators
    const treeLeaves = page.getByTestId("tree-leaf");

    const testWithRetriesIcon = treeLeaves
      .filter({
        has: page.getByText("Test with retries", { exact: true }),
      })
      .getByTestId("tree-item-retries");
    await expect(testWithRetriesIcon).toContainText("2"); // 2 retries

    const anotherTestWithRetriesIcon = treeLeaves
      .filter({
        has: page.getByText("Another test with retries", { exact: true }),
      })
      .getByTestId("tree-item-retries");
    await expect(anotherTestWithRetriesIcon).toContainText("1"); // 1 retry
  });

  test("metadata shows correct count of retries", async ({ page }) => {
    await expect(page.getByTestId("metadata-item-total").getByTestId("metadata-value")).toHaveText("3");
    await expect(page.getByTestId("metadata-item-retries").getByTestId("metadata-value")).toHaveText("2");
  });
});
