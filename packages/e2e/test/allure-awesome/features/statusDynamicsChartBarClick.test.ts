import type { AwesomePluginOptions } from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { epic, feature, label, Stage, Status, story } from "allure-js-commons";

import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import {
  makeHistoryItem,
  makeHistoryTestResults,
  makeReportConfig,
  makeTestResult,
  makeTestResultNames,
} from "../utils/mocks.js";

const reportName = "Status dynamics chart bar click";
const chartTitle = "Status dynamics";

// Fixed history points, each carrying a URL. The Status Dynamics chart maps every
// non-"current" bar to its history point's `url`; clicking such a bar must open that
// URL in a new tab. The "current" bar has no URL and must not open anything.
const historyPoints = [
  makeHistoryItem({
    uuid: "history-point-1",
    name: "run 1",
    timestamp: 1_000,
    url: "https://allurereport.org/history/1",
    testResults: makeHistoryTestResults([
      makeTestResult({ ...makeTestResultNames("history 1 test"), status: Status.PASSED, stage: Stage.FINISHED }),
    ]),
  }),
  makeHistoryItem({
    uuid: "history-point-2",
    name: "run 2",
    timestamp: 2_000,
    url: "https://allurereport.org/history/2",
    testResults: makeHistoryTestResults([
      makeTestResult({ ...makeTestResultNames("history 2 test"), status: Status.PASSED, stage: Stage.FINISHED }),
    ]),
  }),
  makeHistoryItem({
    uuid: "history-point-3",
    name: "run 3",
    timestamp: 3_000,
    url: "https://allurereport.org/history/3",
    testResults: makeHistoryTestResults([
      makeTestResult({ ...makeTestResultNames("history 3 test"), status: Status.PASSED, stage: Stage.FINISHED }),
    ]),
  }),
];

const currentTestResults = [
  makeTestResult({ ...makeTestResultNames("current test a"), status: Status.PASSED, stage: Stage.FINISHED }),
  makeTestResult({ ...makeTestResultNames("current test b"), status: Status.PASSED, stage: Stage.FINISHED }),
];

const pluginConfig = {
  charts: [
    {
      // ChartType.StatusDynamics — string enum value from @allurereport/charts-api,
      // inlined here because the e2e package does not depend on charts-api directly.
      type: "statusDynamics",
      title: chartTitle,
    },
  ],
  sections: ["charts"],
  defaultSection: "charts",
} as unknown as AwesomePluginOptions;

// A stable locator for a single bar inside a specific chart group (keyed by the data point id).
const barByGroupId = (id: string) => `[data-testid="group"][data-id="${id}"] [data-testid="bar"]`;

test.describe("status dynamics chart bar click", () => {
  let bootstrap: ReportBootstrap;

  test.beforeAll(async () => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: makeReportConfig({ name: reportName }),
        history: [...historyPoints],
        testResults: [...currentTestResults],
      },
      pluginConfig,
    );
  });

  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);
    await epic("coverage");
    await feature("charts");
    await story("status-dynamics-bar-click");
    await label("coverage", "charts");

    await page.goto(`${bootstrap.url}#/charts`);
    // The chart renders one group per history point plus the "current" group.
    await expect(page.locator('[data-testid="group"]')).toHaveCount(historyPoints.length + 1);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("opens the history point URL in a new tab when a non-current bar is clicked", async ({ page }) => {
    const targetPoint = historyPoints[1];
    const historyBar = page.locator(barByGroupId(targetPoint.uuid)).first();

    await expect(historyBar).toHaveCount(1);

    // window.open(url, "_blank", ...) opens a new page in the same browser context.
    const [popup] = await Promise.all([
      page.context().waitForEvent("page"),
      // Bars are drawn in a layer with pointer-events: none, so force the click.
      historyBar.click({ force: true }),
    ]);

    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    expect(popup.url()).toContain("/history/2");

    await popup.close();
  });

  test("does not open a new tab when the current bar is clicked", async ({ page }) => {
    const currentBar = page.locator(barByGroupId("current")).first();

    await expect(currentBar).toHaveCount(1);

    let openedPages = 0;
    const onPage = () => {
      openedPages += 1;
    };

    page.context().on("page", onPage);
    await currentBar.click({ force: true });
    await page.waitForTimeout(500);
    page.context().off("page", onPage);

    expect(openedPages).toBe(0);
  });
});
