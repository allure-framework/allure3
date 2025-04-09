import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

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
    {
      name: "1 sample passed test",
      fullName: "sample.js#1 sample passed test",
      status: Status.PASSED,
      stage: Stage.FINISHED,
      start: now + 1000,
      stop: now + 2000,
    },
    {
      name: "2 sample passed test",
      fullName: "sample.js#2 sample passed test",
      status: Status.PASSED,
      stage: Stage.FINISHED,
      start: now + 2000,
      stop: now + 3000,
    },
  ],
};

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test.beforeEach(async ({ browserName }) => {
  await label("env", browserName);
});

test.describe("allure-awesome", () => {
  test.describe("report options", () => {
    test("report title and page title contain give report name", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          history: undefined,
          historyPath: undefined,
          knownIssuesPath: undefined,
          plugins: [
            {
              id: "awesome",
              enabled: true,
              plugin: new AwesomePlugin(),
              options: {},
            },
          ],
        },
        testResults: fixtures.testResults,
      });
      await page.goto(bootstrap.url);

      await expect(page.getByTestId("report-title")).toHaveText("Sample allure report");
      expect(await page.title()).toBe("Sample allure report");
    });

    test("layout Split mode are enabled within plugin options", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          history: undefined,
          historyPath: undefined,
          knownIssuesPath: undefined,
          plugins: [
            {
              id: "awesome",
              enabled: true,
              plugin: new AwesomePlugin({
                layout: "split",
              }),
              options: {
                layout: "split",
              },
            },
          ],
        },
        testResults: fixtures.testResults,
      });
      await page.goto(bootstrap.url);
      await expect(page.getByTestId("base-layout")).toBeHidden();
      await expect(page.getByTestId("split-layout")).toBeVisible();
    });

    test("layout Base mode are enabled by default", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          history: undefined,
          historyPath: undefined,
          knownIssuesPath: undefined,
          plugins: [
            {
              id: "awesome",
              enabled: true,
              plugin: new AwesomePlugin(),
              options: {},
            },
          ],
        },
        testResults: fixtures.testResults,
      });
      await page.goto(bootstrap.url);
      await expect(page.getByTestId("split-layout")).toBeHidden();
      await expect(page.getByTestId("base-layout")).toBeVisible();
    });

    test("render test results which match the filter", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          history: undefined,
          historyPath: undefined,
          knownIssuesPath: undefined,
          plugins: [
            {
              id: "awesome",
              enabled: true,
              plugin: new AwesomePlugin({
                filter: ({ name }) => name === "0 sample passed test",
              }),
              options: {
                filter: ({ name }) => name === "0 sample passed test",
              },
            },
          ],
        },
        testResults: fixtures.testResults,
      });
      await page.goto(bootstrap.url);

      const treeLeaves = page.getByTestId("tree-leaf");

      await expect(treeLeaves).toHaveCount(1);
      await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("0 sample passed test");
      await expect(page.getByTestId("metadata-item-total").getByTestId("metadata-value")).toHaveText("1");
      await expect(page.getByTestId("metadata-item-passed").getByTestId("metadata-value")).toHaveText("1");
    });
  });
});
