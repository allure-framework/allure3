import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { Stage, Status } from "allure-js-commons";
import { AwesomePluginWithoutSummary, type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test.describe("summary", () => {
  test("should render cards for each generated report with summary", async ({ page, context }) => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        history: undefined,
        historyPath: undefined,
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
    const summaryCardsLocator = page.getByTestId("summary-report-card");

    await page.goto(bootstrap.url);

    await expect(summaryCardsLocator).toHaveCount(2);

    const pageUrl = page.url();

    expect(context.pages()).toHaveLength(1);
    expect(context.pages()[0].url()).toBe(pageUrl);

    const [newTab] = await Promise.all([context.waitForEvent("page"), await summaryCardsLocator.nth(0).click()]);

    expect(context.pages()[0].url()).toBe(pageUrl);
    expect(newTab.url()).not.toBe(`${pageUrl}awesome1/index.html`);
  });

  test("should not render cards for reports without summary", async ({ page }) => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        history: undefined,
        historyPath: undefined,
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
    const summaryCardsLocator = page.getByTestId("summary-report-card");

    await page.goto(bootstrap.url);

    await expect(summaryCardsLocator).toHaveCount(2);
  });
});
