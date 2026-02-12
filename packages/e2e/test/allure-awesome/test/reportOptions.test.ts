import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { CommonPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../../utils/index.js";

let bootstrap: ReportBootstrap;
let commonPage: CommonPage;
let treePage: TreePage;

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

test.beforeEach(async ({ page, browserName }) => {
  await label("env", browserName);

  commonPage = new CommonPage(page);
  treePage = new TreePage(page);
});

test.describe("allure-awesome", () => {
  test.describe("report options", () => {
    test("should contain title from config in the page title", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
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

      const pageTitle = await page.title();

      await expect(commonPage.reportTitleLocator).toContainText("Sample allure report");
      expect(pageTitle).toContain("Sample allure report");
    });

    test.describe("layout switching", () => {
      test("should render split layout when it's enabled in the plugin options", async ({ page }) => {
        bootstrap = await bootstrapReport({
          reportConfig: {
            name: "Sample allure report",
            appendHistory: false,
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
        await expect(commonPage.baseLayoutLocator).toBeHidden();
        await expect(commonPage.splitLayoutLocator).toBeVisible();
      });

      test("should render single layout by default", async ({ page }) => {
        bootstrap = await bootstrapReport({
          reportConfig: {
            name: "Sample allure report",
            appendHistory: false,
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
        await expect(commonPage.baseLayoutLocator).toBeVisible();
        await expect(commonPage.splitLayoutLocator).toBeHidden();
      });

      test("should toggle from base layout to splitted one and back", async ({ page }) => {
        bootstrap = await bootstrapReport({
          reportConfig: {
            name: "Sample allure report",
            appendHistory: false,
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
        await commonPage.toggleLayout();
        await expect(commonPage.splitLayoutLocator).toBeVisible();
        await expect(commonPage.baseLayoutLocator).toBeHidden();
        await commonPage.toggleLayout();
        await expect(commonPage.splitLayoutLocator).toBeHidden();
        await expect(commonPage.baseLayoutLocator).toBeVisible();
      });
    });

    test("render test results which match the filter", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
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

      await expect(treePage.leafLocator).toHaveCount(1);
      await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");
      expect(await treePage.getMetadataValue("total")).toBe("1");
      expect(await treePage.getMetadataValue("passed")).toBe("1");
    });
  });
});
