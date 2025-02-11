import { expect, test } from "@playwright/test";
import { Stage, Status } from "allure-js-commons";
import { readdir } from "node:fs/promises";
import { type ReportBootstrap, boostrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;

const now = Date.now();
const fixtures = {
  testResults: [
    {
      name: "0 sample passed test",
      fullName: "sample.js#0 sample passed test",
      status: Status.PASSED,
      stage: Stage.FINISHED,
      start: now,
      stop: now + 1000,
    },
  ],
};

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test.describe("single file mode", () => {
  test("should generate a single file report", async ({ page }) => {
    bootstrap = await boostrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        history: undefined,
        historyPath: undefined,
        knownIssuesPath: undefined,
      },
      pluginConfig: {
        singleFile: true,
      },
      testResults: fixtures.testResults,
    });

    await page.goto(bootstrap.url);

    const files = await readdir(bootstrap.servePath);

    expect(files).toHaveLength(1);
    expect(files).toContain("index.html");
    await expect(page.getByTestId("report-title")).toHaveText("Sample allure report");
  });
});

test.describe("multi file mode", () => {
  test("should generate a multi file report", async ({ page }) => {
    bootstrap = await boostrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        history: undefined,
        historyPath: undefined,
        knownIssuesPath: undefined,
      },
      pluginConfig: {
        singleFile: false,
      },
      testResults: fixtures.testResults,
    });

    await page.goto(bootstrap.url);

    const files = await readdir(bootstrap.servePath);

    expect(files.length > 1).toBe(true);
    await expect(page.getByTestId("report-title")).toHaveText("Sample allure report");
  });
});
