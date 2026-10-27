import { readFile } from "node:fs/promises";
import { join } from "node:path";

import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { attachment, feature, label } from "allure-js-commons";

import { bootstrapReport, type ReportBootstrap } from "../../utils/index.js";

let report: ReportBootstrap | undefined;
test.beforeEach(async ({ browserName }) => {
  await feature("performance-metrics-timeline");
  await label("env", browserName);
});
test.afterEach(async () => {
  await report?.shutdown();
  report = undefined;
});

test("retries a failed timeline chunk without losing the table", async ({ page }) => {
  report = await bootstrapReport({
    reportConfig: {
      plugins: [{ id: "awesome", enabled: true, options: {}, plugin: new AwesomePlugin({ charts: [] }) }],
    },
    attachments: [
      {
        source: "sample-perf.json",
        content: Buffer.from(JSON.stringify([{ id: "one", key: "one", value: 1, start: 0, stop: 1 }])),
      },
    ],
  });
  let requests = 0;
  await page.route("**/chart-metrics-timeline-*.js", (route) => {
    requests++;
    return requests === 1 ? route.fulfill({ status: 503, body: "temporary failure" }) : route.continue();
  });
  await page.goto(`${report.url}/#metrics`);
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.getByText("Failed to load chart", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("metric-interval")).toHaveCount(1);
  expect(requests).toBe(2);
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Metric summary", exact: true })).toBeVisible();
});

for (const singleFile of [false, true]) {
  test(`measurement timeline preserves overlaps and loads on demand (${singleFile ? "single file" : "directory"})`, async ({
    page,
  }) => {
    const metrics = [
      { id: "run", key: "run", value: 100, start: 1000, stop: 1100 },
      { id: "a", key: "child", value: 80, start: 1000, stop: 1080 },
      { id: "b", key: "child", value: 80, start: 1020, stop: 1100 },
      { id: "regressed", key: "regressed", value: 20, start: 1010, stop: 1020 },
      { id: "bench", key: "bench", value: 0.001, start: 2000, stop: 3000 },
    ];
    report = await bootstrapReport({
      reportConfig: {
        appendHistory: false,
        performance: {
          metrics: {
            run: { title: "Run", unit: "ms", better: "lower" },
            missing: { title: "Missing", unit: "ms", better: "lower", parent: "run" },
            child: {
              title: "A very long operation name that must remain readable when the window becomes narrow",
              unit: "ms",
              better: "lower",
              parent: "missing",
            },
            regressed: { title: "Slower", unit: "ms", better: "lower", parent: "run" },
            bench: { title: "Benchmark", unit: "ms", better: "lower" },
          },
        },
        plugins: [{ id: "awesome", enabled: true, options: {}, plugin: new AwesomePlugin({ singleFile, charts: [] }) }],
      },
      attachments: [{ source: "sample-perf.json", content: Buffer.from(JSON.stringify(metrics)) }],
      history: [
        {
          uuid: "prior",
          name: "Prior",
          timestamp: 1,
          url: "https://example.com/prior",
          knownTestCaseIds: [],
          testResults: {},
          metrics: { run: 120, child: 100, regressed: 10 },
        },
      ],
    });
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`${report.url}/#metrics`);
    await expect(page.getByTestId("metrics-view")).toBeVisible();
    expect(requests.some((url) => url.includes("chart-metrics-timeline"))).toBe(false);
    if (singleFile) {
      const html = await readFile(join(report.reportDir, "index.html"), "utf8");
      expect(html).toContain("chart-metrics-timeline");
    }
    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    const timeline = page.getByTestId("metrics-timeline");
    await expect(timeline).toBeVisible();
    const picker = timeline.getByRole("button", { name: "Benchmark", exact: true });
    await picker.click();
    const rootOption = page.getByRole("button", { name: "Run run", exact: true });
    const triggerBox = (await picker.boundingBox())!;
    const optionBox = (await rootOption.boundingBox())!;
    expect(Math.abs(optionBox.x - triggerBox.x)).toBeLessThan(24);
    await rootOption.click();
    await expect(timeline.getByText("No measurement", { exact: true })).toHaveCount(0);
    await expect(timeline.getByTestId("metric-timeline-row")).toHaveCount(3);
    const bars = timeline.getByTestId("metric-interval").filter({ hasText: "A very long operation" });
    await expect(bars).toHaveCount(2);
    const geometry = await bars.evaluateAll((items) =>
      items.map((item) => {
        const r = item.getBoundingClientRect();
        const track = item.parentElement!.getBoundingClientRect();
        return { width: r.width / track.width, left: (r.left - track.left) / track.width, top: r.top };
      }),
    );
    expect(geometry[0].width).toBeCloseTo(0.8, 2);
    expect(geometry[1].width).toBeCloseTo(0.8, 2);
    expect(geometry[0].left).toBeCloseTo(0, 2);
    expect(geometry[1].left).toBeCloseTo(0.2, 2);
    expect(geometry[1].top).toBeGreaterThan(geometry[0].top);
    await expect(bars.first()).toHaveAttribute("data-direction", "good");
    await expect(timeline.getByTestId("metric-interval").filter({ hasText: "Slower" })).toHaveAttribute(
      "data-direction",
      "bad",
    );
    await timeline.getByTestId("metric-interval").filter({ hasText: "Run" }).hover();
    await expect(page.getByRole("tooltip")).toHaveCount(1);
    await bars.first().focus();
    await expect(page.getByRole("tooltip")).toHaveCount(1);
    await expect(page.getByRole("tooltip")).toContainText("Previous average: 100 ms");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(timeline.getByRole("button", { name: "Reset zoom", exact: true })).toBeVisible();
    expect(
      await bars
        .first()
        .evaluate((item) => item.getBoundingClientRect().width / item.parentElement!.getBoundingClientRect().width),
    ).toBeCloseTo(1, 2);
    await timeline.getByRole("button", { name: "Reset zoom", exact: true }).click();
    expect(
      await bars
        .first()
        .evaluate((item) => item.getBoundingClientRect().width / item.parentElement!.getBoundingClientRect().width),
    ).toBeCloseTo(0.8, 2);
    await timeline.getByTestId("metric-interval").filter({ hasText: "Slower" }).click();
    // A bar touching the zoom boundary is outside the view, not a synthetic zero-duration sample.
    await expect(bars).toHaveCount(1);
    await timeline.getByRole("button", { name: "Reset zoom", exact: true }).click();
    await expect(bars).toHaveCount(2);
    await page.setViewportSize({ width: 780, height: 700 });
    await expect(bars.first()).toBeVisible();
    await page.getByRole("button", { name: "Table", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(timeline).toHaveCount(0);
    await page.getByRole("button", { name: "Timeline", exact: true }).click();
    await expect(page.getByTestId("metrics-timeline").getByRole("button", { name: "Run", exact: true })).toBeVisible();
    await attachment("Timeline", await page.screenshot({ fullPage: true }), "image/png");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(bars.first()).toBeVisible();
    await attachment("Timeline dark", await page.screenshot({ fullPage: true, animations: "disabled" }), "image/png");
  });
}
