import { expect, test } from "@playwright/test";
import { Stage, Status, layer } from "allure-js-commons";
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

test.beforeEach(async () => {
  await layer("e2e");
});

test.describe("allure-awesome", () => {
  test.describe("report options", () => {
    test("report title and page title contain give report name", async ({ page }) => {
      bootstrap = await boostrapReport({
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          history: undefined,
          historyPath: undefined,
          knownIssuesPath: undefined,
        },
        testResults: fixtures.testResults,
      });
      await page.goto(bootstrap.url);

      await expect(page.getByTestId("report-title")).toHaveText("Sample allure report");
      expect(await page.title()).toBe("Sample allure report");
    });

    test("layout Split mode are enabled within plugin options", async ({ page }) => {
      bootstrap = await boostrapReport({
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          history: undefined,
          historyPath: undefined,
          knownIssuesPath: undefined,
        },
        testResults: fixtures.testResults,
        pluginConfig: {
          layout: "split",
        },
      });
      await page.goto(bootstrap.url);
      await expect(page.getByTestId("base-layout")).toBeHidden();
      await expect(page.getByTestId("split-layout")).toBeVisible();
    });
    test("layout Base mode are enabled by default", async ({ page }) => {
      bootstrap = await boostrapReport({
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          history: undefined,
          historyPath: undefined,
          knownIssuesPath: undefined,
        },
        testResults: fixtures.testResults,
      });
      await page.goto(bootstrap.url);
      await expect(page.getByTestId("split-layout")).toBeHidden();
      await expect(page.getByTestId("base-layout")).toBeVisible();
    });
  });
});
