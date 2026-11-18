import { ChartType, type ChartOptions } from "@allurereport/charts-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { expect, test } from "@playwright/test";
import { feature, Status } from "allure-js-commons";

import { makeHistoryItem, makeHistoryTestResults, makeTestResult } from "../allure-awesome/utils/mocks.js";
import { bootstrapReport, type ReportBootstrap } from "../utils/index.js";

let report: ReportBootstrap;

test.beforeAll(async () => {
  const charts: ChartOptions[] = [{ type: ChartType.StatusTransitions }, { type: ChartType.TestBaseGrowthDynamics }];
  report = await bootstrapReport({
    history: [100, 200].map((timestamp) =>
      makeHistoryItem({
        timestamp,
        testResults: makeHistoryTestResults([
          makeTestResult({ name: "example", fullName: "example", historyId: "example", status: Status.FAILED }),
        ]),
      }),
    ),
    testResults: [
      { name: "example", fullName: "example", historyId: "example", status: Status.PASSED },
      { name: "added", fullName: "added", historyId: "added", status: Status.PASSED },
    ],
    reportConfig: {
      appendHistory: false,
      plugins: [
        {
          id: "awesome",
          enabled: true,
          options: {},
          plugin: new AwesomePlugin({ singleFile: false, charts, sections: ["charts"], defaultSection: "charts" }),
        },
        {
          id: "dashboard",
          enabled: true,
          options: {},
          plugin: new DashboardPlugin({ singleFile: false, layout: charts }),
        },
      ],
    },
  });
});

test.afterAll(async () => {
  await report?.shutdown();
});

for (const frontend of ["awesome", "dashboard"] as const) {
  test(`${frontend} preserves both charts when trend help expands in narrow and wide cards`, async ({ page }) => {
    await feature("diff-chart-trends");
    const url = new URL(`${frontend}/index.html`, report.url);
    if (frontend === "awesome") url.hash = "/charts";

    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto(url.href);
      const charts = page.locator('div[data-value-trends="true"]');
      await expect(charts).toHaveCount(2);
      for (const chart of await charts.all()) {
        const svg = chart.locator("svg").first();
        await expect(svg).toBeVisible();
        const initial = await svg.boundingBox();
        expect(initial!.height).toBeGreaterThanOrEqual(275);
        const help = chart.getByText("How to read the trends", { exact: true });
        await help.focus();
        await page.keyboard.press("Enter");
        await expect(chart.locator("details")).toHaveAttribute("open", "");
        await expect(svg).toBeVisible();
        await expect(chart.getByTestId("trend-line")).toHaveCount(2);
        const expanded = await svg.boundingBox();
        expect(expanded!.height).toBeGreaterThanOrEqual(initial!.height);
        await expect(chart.locator("p")).toBeVisible();
        const bounds = await chart.boundingBox();
        const explanation = await chart.locator("p").boundingBox();
        expect(explanation!.y).toBeGreaterThanOrEqual(expanded!.y + expanded!.height);
        expect(explanation!.y + explanation!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
        await help.press("Enter");
        await expect(chart.locator("details")).not.toHaveAttribute("open", "");
      }
    }
  });
}
