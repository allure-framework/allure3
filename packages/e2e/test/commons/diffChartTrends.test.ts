import { ChartType, type ChartOptions } from "@allurereport/charts-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { expect, type Locator, test } from "@playwright/test";
import { feature, Status } from "allure-js-commons";

import {
  makeHistoryItem,
  makeHistoryTestResult,
  makeHistoryTestResults,
  makeTestResult,
} from "../allure-awesome/utils/mocks.js";
import { bootstrapReport, type ReportBootstrap } from "../utils/index.js";

const reportConfig = (charts: ChartOptions[]) => ({
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
});

const dayInOctober = (day: number) => Date.UTC(2026, 9, day);

const chartSelector = '[data-value-trends="true"]';

const reportUrl = (frontend: "awesome" | "dashboard", report: ReportBootstrap) => {
  const url = new URL(`${frontend}/index.html`, report.url);
  if (frontend === "awesome") url.hash = "/charts";
  return url.href;
};

const fitsViewport = async (tooltip: Locator, width: number) => {
  await expect
    .poll(async () => {
      const box = await tooltip.boundingBox();
      return !!box && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 850;
    })
    .toBe(true);
  await expect.poll(() => tooltip.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
};

const expectTrendComparison = async (tooltip: Locator, metric: string, observed: string, estimate: string) => {
  const row = tooltip.getByText(metric, { exact: true }).locator("..");
  await expect(row.locator("dd").filter({ hasText: "Observed" })).toHaveText(`Observed ${observed}`);
  await expect(row.locator("dd").filter({ hasText: "Trend estimate" })).toHaveText(`Trend estimate ${estimate}`);
};

let report: ReportBootstrap;
let extremeReport: ReportBootstrap;
let longHistoryReport: ReportBootstrap;

test.beforeAll(async () => {
  const previousAddition = {
    name: "prior addition",
    fullName: "prior addition",
    historyId: "prior-addition",
    status: Status.PASSED,
  };
  const previousFix = { name: "prior fix", fullName: "prior fix", historyId: "prior-fix", status: Status.PASSED };
  report = await bootstrapReport({
    history: [
      makeHistoryItem({
        timestamp: dayInOctober(1),
        testResults: makeHistoryTestResults([
          makeTestResult({ name: "added", fullName: "added", historyId: "added", status: Status.FAILED }),
        ]),
      }),
      ...[2, 3, 4].map((day) =>
        makeHistoryItem({
          timestamp: dayInOctober(day),
          testResults: makeHistoryTestResults([
            makeTestResult({ name: "example", fullName: "example", historyId: "example", status: Status.FAILED }),
            makeTestResult({ name: "removed", fullName: "removed", historyId: "removed", status: Status.FAILED }),
            makeTestResult({ ...previousFix, status: day === 4 ? Status.PASSED : Status.FAILED }),
            ...(day === 4 ? [makeTestResult(previousAddition)] : []),
          ]),
        }),
      ),
    ],
    testResults: [
      previousAddition,
      previousFix,
      { name: "example", fullName: "example", historyId: "example", status: Status.PASSED },
      { name: "added", fullName: "added", historyId: "added", status: Status.PASSED },
      { name: "added again", fullName: "added again", historyId: "added-again", status: Status.SKIPPED },
    ],
    reportConfig: reportConfig([
      { type: ChartType.StatusTransitions, limit: 3 },
      { type: ChartType.TestBaseGrowthDynamics, limit: 3 },
    ]),
  });

  const statuses = [Status.PASSED, Status.FAILED, Status.BROKEN, Status.SKIPPED, undefined];
  const run = (index: number) => {
    const changes = Math.max(0, index - 2) * 100;
    const results = [
      ...Array.from({ length: changes }, (_, i) => ({ name: `added-${i}`, status: Status.PASSED })),
      ...Array.from({ length: 400 - changes }, (_, i) => ({ name: `removed-${i}`, status: Status.FAILED })),
      ...statuses.map((status) => ({ name: index === 6 ? `new-${status}` : `old-${status}`, status })),
    ];

    return results.map((result) => ({ ...result, fullName: result.name, historyId: result.name }));
  };

  extremeReport = await bootstrapReport({
    history: Array.from({ length: 6 }, (_, index) =>
      makeHistoryItem({
        timestamp: dayInOctober(index + 1),
        testResults: Object.fromEntries(
          run(index).map((result) => {
            const historical = makeHistoryTestResult(makeTestResult(result));
            return [result.historyId, { ...historical, status: result.status ?? "unknown" }];
          }),
        ),
      }),
    ),
    testResults: run(6),
    reportConfig: reportConfig([
      { type: ChartType.TestBaseGrowthDynamics, statuses: ["passed"], title: "Passed tests" },
      { type: ChartType.TestBaseGrowthDynamics, statuses: ["failed"], title: "Failed tests" },
      { type: ChartType.TestBaseGrowthDynamics, title: "All statuses" },
    ]),
  });

  const stable = { name: "stable", fullName: "stable", historyId: "stable", status: Status.PASSED };
  const removed = { name: "removed", fullName: "removed", historyId: "removed", status: Status.PASSED };
  const transient = { name: "transient", fullName: "transient", historyId: "transient", status: Status.BROKEN };
  longHistoryReport = await bootstrapReport({
    history: Array.from({ length: 60 }, (_, index) =>
      makeHistoryItem({
        timestamp: dayInOctober(index - 60),
        testResults: makeHistoryTestResults(
          (index === 1 ? [stable, removed, transient] : [stable, removed]).map((result) => makeTestResult(result)),
        ),
      }),
    ),
    testResults: [stable, { name: "new", fullName: "new", historyId: "new", status: Status.FAILED }],
    reportConfig: reportConfig([
      { type: ChartType.TestBaseGrowthDynamics, statuses: ["passed"], title: "Passed tests", limit: 60 },
      { type: ChartType.TestBaseGrowthDynamics, title: "All statuses", limit: 60 },
    ]),
  });
});

test.afterAll(async () => {
  await Promise.all([report?.shutdown(), extremeReport?.shutdown(), longHistoryReport?.shutdown()]);
});

for (const frontend of ["awesome", "dashboard"] as const) {
  test(`${frontend} groups growth counters and shows fitted trends in test counts`, async ({ page }) => {
    await feature("diff-chart-trends");
    await page.goto(reportUrl(frontend, report));

    const growth = page.locator(chartSelector).last();
    const runs = growth.getByTestId("hover-rect");
    const tooltip = page.getByTestId("chart-tooltip");

    await expect(runs).toHaveCount(3);
    await runs.first().hover();
    await expect(tooltip).toContainText("No changes");
    await expect(tooltip.getByText("New tests", { exact: true })).toHaveCount(0);
    await expect(tooltip.getByText("Removed tests", { exact: true })).toHaveCount(0);

    await runs.last().hover();
    await expect(tooltip.getByText("No changes")).toHaveCount(0);
    await expect(tooltip.getByText("New tests", { exact: true })).toBeVisible();
    await expect(tooltip.getByText("Removed tests", { exact: true })).toBeVisible();
    const added = tooltip.getByText("New tests", { exact: true }).locator("..");
    const removed = tooltip.getByText("Removed tests", { exact: true }).locator("..");
    await expect(added.getByText(/^passed: 1$/i)).toHaveCount(1);
    await expect(added.getByText(/^skipped: 1$/i)).toHaveCount(1);
    await expect(removed.getByText(/^failed: 1$/i)).toHaveCount(1);
    await expect(added.getByTestId(/tree-leaf-status-/)).toHaveCount(2);
    await expect(removed.getByTestId(/tree-leaf-status-/)).toHaveCount(1);
    await expect(tooltip.getByTestId(/tree-leaf-status-/)).toHaveCount(3);
    // Per-run [0, 1, 1] and cumulative [0, 1, 2] have distinct observations and fits.
    await expectTrendComparison(tooltip, "Net change this run", "+1", "+1.167");
    await expectTrendComparison(tooltip, "Cumulative net change", "+2", "+2");
  });

  test(`${frontend} keeps both extrema of filtered trends and shows the dense tooltip at 320 px`, async ({
    page,
  }, testInfo) => {
    await feature("diff-chart-trends");
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto(reportUrl(frontend, extremeReport));
    const charts = page.locator(chartSelector);
    await expect(charts).toHaveCount(3);
    for (const [index, trendValue] of [
      [0, "+123.81"],
      [1, "-123.81"],
    ] as const) {
      const chart = charts.nth(index);
      // The last comparison has the same status turnover on both sides, so the net series is ±[0,0,100,100,100,100].
      await expect
        .poll(() =>
          chart.evaluate((element) => {
            const layer = element.querySelector('[data-testid="trend-lines-layer"]');
            const clip = layer?.querySelector("clipPath rect");
            const line = layer?.querySelector<SVGPathElement>('[data-trend-key="diffTrend"] path');
            if (!line || !clip || line.getTotalLength() === 0) return false;
            const end = line.getPointAtLength(line.getTotalLength());
            return end.y > 0 && end.y < Number(clip.getAttribute("height"));
          }),
        )
        .toBe(true);
      await expect(chart.locator("svg text").filter({ hasText: /^Latest$/ })).toBeVisible();
      await expect
        .poll(() =>
          chart
            .locator("svg text")
            .filter({ hasText: /\d+\/\d+\/\d+/ })
            .count(),
        )
        .toBeLessThan(5);
      await chart.getByTestId("hover-rect").last().hover();
      const tooltip = page.getByTestId("chart-tooltip");
      await expect(tooltip.getByText(trendValue, { exact: true })).toBeVisible();
      await fitsViewport(tooltip, 320);
    }
    await charts.last().getByTestId("hover-rect").last().hover();
    const tooltip = page.getByTestId("chart-tooltip");
    for (const status of ["passed", "failed", "broken", "skipped", "unknown"]) {
      await expect(tooltip.getByText(new RegExp(`^${status}: [0-9]+$`, "i"))).toHaveCount(2);
    }
    await expect(tooltip.getByText("0", { exact: true })).toHaveCount(4);
    await fitsViewport(tooltip, 320);
    await expect(tooltip.locator("..")).toHaveCSS("opacity", "1");
    await testInfo.attach("dense-tooltip-320px", { body: await page.screenshot(), contentType: "image/png" });
  });

  test(`${frontend} renders localized numbers and status labels with keyboard and touch`, async ({
    browser,
  }, testInfo) => {
    await feature("diff-chart-trends");
    const context = await browser.newContext({
      viewport: { width: 320, height: 850 },
      hasTouch: true,
      colorScheme: "dark",
    });
    try {
      const page = await context.newPage();
      const locale = frontend === "awesome" ? "fa" : "fr";
      await page.addInitScript((value) => localStorage.setItem("currentLocale", value), locale);
      await page.goto(reportUrl(frontend, report));
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.locator("html")).toHaveAttribute("dir", frontend === "awesome" ? "rtl" : "ltr");
      const growth = page.locator(chartSelector).last();
      const count = new Intl.NumberFormat(locale).format(3);
      await expect(growth.getByTestId("trend-summary")).toContainText(
        frontend === "awesome" ? `بر اساس ${count} مقایسه` : `Sur la base de ${count} comparaisons`,
      );
      const runs = growth.getByTestId("hover-rect");
      const run = runs.last();
      const tooltip = page.getByTestId("chart-tooltip");
      await runs.nth(1).focus();
      await page.keyboard.press("Tab");
      await expect(run).toBeFocused();
      await expect(tooltip).toContainText(frontend === "awesome" ? "تست‌های جدید" : "Nouveaux tests");
      await expect(run).toHaveAttribute("aria-describedby", /.+/);
      const decimal = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" }).format(1.167);
      await expect(tooltip.getByText(decimal, { exact: true })).toHaveCount(1);
      await fitsViewport(tooltip, 320);
      await run.hover();
      await page.mouse.move(1, 1);
      await expect(run).toBeFocused();
      await expect(tooltip.getByText(decimal, { exact: true })).toHaveCount(1);
      await runs.first().hover();
      await expect(tooltip.getByText(decimal, { exact: true })).toHaveCount(0);
      await page.mouse.move(1, 1);
      await expect(tooltip.getByText(decimal, { exact: true })).toHaveCount(1);
      await runs.first().hover();
      await expect(tooltip.getByText(decimal, { exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(tooltip).toHaveCount(0);
      await page.mouse.move(1, 1);
      await expect(tooltip).toHaveCount(0);
      await run.tap();
      await expect(tooltip.getByText(decimal, { exact: true })).toHaveCount(1);
      await fitsViewport(tooltip, 320);
      await expect(tooltip.locator("..")).toHaveCSS("opacity", "1");
      await testInfo.attach(`${locale}-tooltip-320px`, { body: await page.screenshot(), contentType: "image/png" });
    } finally {
      await context.close();
    }
  });

  test(`${frontend} keeps 60 distinct comparisons accessible at 320 px`, async ({ page }) => {
    await feature("diff-chart-trends");
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto(reportUrl(frontend, longHistoryReport));
    const growth = page.locator(chartSelector).last();
    const runs = growth.getByTestId("hover-rect");

    await expect(runs).toHaveCount(60);
    await expect(growth.getByTestId("trend-summary")).toContainText("Based on 60 comparisons");
    const boxes = await runs.evaluateAll((nodes) =>
      nodes.map((node) => {
        const { x, width } = node.getBoundingClientRect();
        return { x, width };
      }),
    );
    expect(new Set(boxes.map(({ x }) => x)).size).toBe(60);
    expect(Math.min(...boxes.map(({ width }) => width))).toBeGreaterThan(2);

    // The net series is [1, -1, 0, …, 0]. The slope is negative even though it rounds to zero at 3 decimals.
    await expect(growth.getByTestId("trend-summary")).toContainText("Net change shifts by -0.0000556 each run");
    await runs.nth(2).hover();
    const tooltip = page.getByTestId("chart-tooltip");
    await expect(tooltip).toContainText("No changes");
    await runs.last().hover();
    await expect(tooltip.getByText("New tests", { exact: true })).toBeVisible();
    await expect(tooltip.getByText(/^failed: 1$/i)).toHaveCount(1);
    await expect(tooltip.getByText("Removed tests", { exact: true })).toBeVisible();
    await expect(tooltip.getByText(/^passed: 1$/i)).toHaveCount(1);
    await fitsViewport(tooltip, 320);
  });

  test(`${frontend} shows both slope summaries and transition comparisons in narrow and wide cards`, async ({
    page,
  }, testInfo) => {
    await feature("diff-chart-trends");
    const url = reportUrl(frontend, report);

    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto(url);
      const charts = page.locator(chartSelector);
      await expect(charts).toHaveCount(2);
      for (const [index, chart] of (await charts.all()).entries()) {
        const svg = chart.locator("svg").first();
        await expect(svg).toBeVisible();
        const plot = await svg.boundingBox();
        expect(plot!.height).toBeGreaterThanOrEqual(275);
        await expect(chart.getByTestId("trend-line")).toHaveCount(2);
        const summary = chart.getByTestId("trend-summary");
        await expect(summary).toContainText("Based on 3 comparisons");
        await expect(summary).toContainText(index === 0 ? "+1.5 net transitions per run" : "+1 tests per run");
        await expect(summary).toContainText(
          index === 0 ? "Net change shifts by +1 each run" : "Net change shifts by +0.5 each run",
        );
        const summaryBox = await summary.boundingBox();
        const chartBox = await chart.boundingBox();
        expect(summaryBox!.y).toBeGreaterThanOrEqual(plot!.y + plot!.height);
        expect(summaryBox!.x + summaryBox!.width).toBeLessThanOrEqual(chartBox!.x + chartBox!.width + 1);
      }
      await testInfo.attach(`trend-summary-${width}`, { body: await page.screenshot(), contentType: "image/png" });
      await charts.first().getByTestId("hover-rect").last().hover();
      const tooltip = page.getByTestId("chart-tooltip");
      await expect(tooltip).toContainText(/Fixed\s*2/i);
      // The earlier status fix makes the cumulative series [0, 1, 3].
      await expectTrendComparison(tooltip, "Net change this run", "+2", "+2");
      await expectTrendComparison(tooltip, "Cumulative net change", "+3", "+2.833");
      if (width === 320) await fitsViewport(tooltip, width);
      await expect(tooltip.locator("..")).toHaveCSS("opacity", "1");
      await testInfo.attach(`transition-details-${width}`, { body: await page.screenshot(), contentType: "image/png" });
    }
  });
}
