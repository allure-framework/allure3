import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { CommonPage, SummaryPage } from "../pageObjects/index.js";
import { AwesomePluginWithoutSummary, type ReportBootstrap, bootstrapReport } from "../utils/index.js";

test.describe("summary", () => {
  let bootstrap: ReportBootstrap;
  let summaryPage: SummaryPage;
  let commonPage: CommonPage;

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test.beforeEach(async ({ page, browserName }) => {
    await label("env", browserName);

    commonPage = new CommonPage(page);
    summaryPage = new SummaryPage(page);
  });

  test("should not generate summary for a single report", async ({ page }) => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
        plugins: [
          {
            id: "awesome1",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
        ],
      },
      testResults: [
        {
          name: "0 sample passed test",
          fullName: "sample.js#0 sample passed test",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
        },
      ],
    });

    await page.goto(bootstrap.url);

    await expect(summaryPage.reportCardLocator).not.toBeVisible();
    await expect(commonPage.baseLayoutLocator).toBeVisible();
  });

  test("should not generate summary on the single report re-generation", async ({ page }) => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
        plugins: [
          {
            id: "awesome1",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
        ],
      },
      testResults: [
        {
          name: "0 sample passed test",
          fullName: "sample.js#0 sample passed test",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
        },
      ],
    });

    await page.goto(bootstrap.url);

    await expect(summaryPage.reportCardLocator).not.toBeVisible();
    await expect(commonPage.baseLayoutLocator).toBeVisible();

    await bootstrap.regenerate();
    await page.reload();

    await expect(summaryPage.reportCardLocator).not.toBeVisible();
    await expect(commonPage.baseLayoutLocator).toBeVisible();
  });

  test("should render cards for each generated report with summary", async ({ page, context }) => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
        plugins: [
          {
            id: "awesome1",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
          {
            id: "awesome2",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
        ],
      },
      testResults: [
        {
          name: "0 sample passed test",
          fullName: "sample.js#0 sample passed test",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
        },
      ],
    });

    await page.goto(bootstrap.url);

    await expect(summaryPage.reportCardLocator).toHaveCount(2);

    const pageUrl = page.url();

    expect(context.pages()).toHaveLength(1);
    expect(context.pages()[0].url()).toBe(pageUrl);

    const [newTab] = await Promise.all([context.waitForEvent("page"), await summaryPage.clickReportCard(0)]);

    expect(context.pages()[0].url()).toBe(pageUrl);
    expect(newTab.url()).not.toBe(`${pageUrl}awesome1/index.html`);
  });

  test("should not render cards for reports without summary", async ({ page }) => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
        plugins: [
          {
            id: "awesome1",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
          {
            id: "awesome2",
            enabled: true,
            plugin: new AwesomePlugin({}),
            options: {},
          },
          {
            id: "awesome3",
            enabled: true,
            plugin: new AwesomePluginWithoutSummary({}),
            options: {},
          },
        ],
      },
      testResults: [
        {
          name: "0 sample passed test",
          fullName: "sample.js#0 sample passed test",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
        },
      ],
    });

    await page.goto(bootstrap.url);

    await expect(summaryPage.reportCardLocator).toHaveCount(2);
  });
});
