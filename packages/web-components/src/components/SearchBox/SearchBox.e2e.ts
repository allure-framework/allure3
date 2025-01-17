import { expect, test } from "@playwright/test";
import { Stage, Status, layer } from "allure-js-commons";
import { type ReportBootstrap, boostrapReport } from "@/utils";

let bootstrap: ReportBootstrap;

test.beforeAll(async () => {
  bootstrap = await boostrapReport({
    reportConfig: {
      name: "Sample allure report",
      appendHistory: false,
      history: [],
      historyPath: "",
      knownIssuesPath: "",
    },
    pluginConfig: {
      groupBy: ["story"],
    },
    testResults: [
      {
        name: "0 sample passed test",
        fullName: "sample.js#0 sample passed test",
        status: Status.PASSED,
        stage: Stage.FINISHED,
        start: 1000,
        labels: [{ name: "story", value: "foo" }],
      },
      {
        name: "1 sample failed test",
        fullName: "sample.js#1 sample failed test",
        status: Status.FAILED,
        stage: Stage.FINISHED,
        start: 5000,
        statusDetails: {
          message: "Assertion error: Expected 1 to be 2",
          trace: "failed test trace",
        },
      },
    ],
  });
});

test.beforeEach(async ({ page }) => {
  await layer("e2e");
  await page.goto(bootstrap.url as string);
});

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test.describe("SearchBox component with debounce", () => {
  test("should update value with debounce and clear input", async ({ page }) => {
    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toHaveValue("");
    const clearButton = page.getByTestId("clear-button");

    await searchInput.fill("i am input");
    await page.waitForTimeout(300);
    await page.waitForSelector('[data-testid="clear-button"]', { state: "attached" });
    await expect(clearButton).toBeVisible();
    await expect(clearButton).toBeHidden();

    await expect(clearButton).toBeVisible();

    await clearButton.click();

    await expect(searchInput).toHaveValue("");

    await expect(clearButton).toBeHidden();
  });
});
