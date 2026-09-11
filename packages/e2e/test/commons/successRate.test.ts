import { ChartType, type ChartOptions } from "@allurereport/charts-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import ClassicPlugin from "@allurereport/plugin-classic";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { expect, test } from "@playwright/test";
import { Status, type TestResult } from "allure-js-commons";

import { bootstrapReport, type ReportBootstrap } from "../utils/index.js";

const scenarios = [
  { name: "issue 3489", counts: { passed: 493, failed: 45, skipped: 95 }, rate: "91.63%", total: 633 },
  { name: "all excluded", counts: { skipped: 2, unknown: 1 }, rate: "0%", total: 3 },
  { name: "empty", counts: {}, rate: "???", total: 0 },
];
const charts: ChartOptions[] = [
  { type: ChartType.SuccessRateDistribution, title: "Success rate distribution" },
  { type: ChartType.TestingPyramid, title: "Testing pyramid" },
];

for (const scenario of scenarios) {
  test.describe(`success rate across reports: ${scenario.name}`, () => {
    let report: ReportBootstrap;

    test.beforeAll(async () => {
      test.setTimeout(120_000);

      const testResults: Partial<TestResult>[] = Object.entries(scenario.counts).flatMap(([status, count]) =>
        Array.from({ length: count }, (_, index) => ({
          name: `${status} ${index}`,
          fullName: `${status} ${index}`,
          status: status as Status,
          start: 1_700_000_000_000 + index,
          stop: 1_700_000_000_010 + index,
          labels: [
            { name: "feature", value: "Checkout" },
            { name: "layer", value: "unit" },
          ],
        })),
      );
      report = await bootstrapReport({
        testResults,
        reportConfig: {
          name: "Success rate",
          appendHistory: false,
          plugins: [
            {
              id: "awesome",
              enabled: true,
              plugin: new AwesomePlugin({ singleFile: false, charts }),
              options: {},
            },
            { id: "classic", enabled: true, plugin: new ClassicPlugin({ singleFile: false }), options: {} },
            {
              id: "dashboard",
              enabled: true,
              plugin: new DashboardPlugin({ singleFile: false, layout: charts }),
              options: {},
            },
          ],
        },
      });
    });

    test.afterAll(async () => {
      await report?.shutdown();
    });

    test("summary cards preserve precision and accessible explanations", async ({ page }, testInfo) => {
      await page.goto(report.url);

      const cards = page.locator('[data-testid="summary-report-card"]');

      await expect(cards).toHaveCount(3);

      for (const card of await cards.all()) {
        const caption = card.getByRole("img", { name: `Success rate: ${scenario.rate}`, exact: true });

        await expect(caption).toHaveText(scenario.rate);

        await caption.focus();

        await expect(page.getByRole("tooltip")).toHaveText(`Success rate: ${scenario.rate}`);

        await page.keyboard.press("Escape");

        await expect(page.getByRole("tooltip")).toHaveCount(0);
      }
      await testInfo.attach("input statistics", { body: JSON.stringify(scenario), contentType: "application/json" });
      await testInfo.attach("summary charts", { body: await page.screenshot(), contentType: "image/png" });
    });

    for (const frontend of ["awesome", "classic", "dashboard"]) {
      test(`${frontend} charts use the same eligible denominator`, async ({ page }, testInfo) => {
        await page.goto(`${report.url}/${frontend}/index.html${frontend === "classic" ? "#overview" : ""}`);

        if (frontend === "awesome") {
          const caption = page.getByRole("img", { name: `Success rate: ${scenario.rate}`, exact: true });

          await expect(caption).toHaveText(scenario.rate);

          await caption.focus();

          await expect(page.getByRole("tooltip")).toContainText("Success rate");

          await page.setViewportSize({ width: 1280, height: 900 });

          await expect(caption).toBeFocused();

          await testInfo.attach("focused success explanation", {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          await page.keyboard.press("Escape");

          await expect(page.getByRole("tooltip")).toHaveCount(0);

          if (scenario.name === "issue 3489") {
            const slice = page.getByRole("img", { name: /493 [Pp]assed \(77.88% of all tests\)/ });

            await slice.focus();

            await expect(page.getByRole("tooltip")).toContainText("77.88% of all tests");

            await page.keyboard.press("Escape");
          }
        }

        if (frontend === "awesome") {
          await page.goto(`${report.url}/awesome/index.html#/charts`);
        }

        if (scenario.total > 0) {
          // Classic displays these charts on its overview route.
          const node = page.locator("rect[aria-label]");
          const target = page.getByRole("img", {
            name: new RegExp(`^Checkout: Success rate: ${scenario.rate.replace(".", "\\.")}`),
          });

          await expect(target).toBeVisible();

          await target.focus();

          await expect(target).toBeFocused();

          await expect(page.getByRole("tooltip")).toContainText(
            scenario.name === "all excluded"
              ? "There are no passed, failed, or broken tests."
              : "Skipped and unknown tests are excluded.",
          );

          await page.keyboard.press("Escape");

          const layer = page.getByRole("img", {
            name: new RegExp(`Layer: unit;.*Success rate: ${scenario.rate.replace(".", "\\.")}`),
          });

          await expect(layer).toBeVisible();

          await layer.focus();

          await expect(layer).toBeFocused();

          await expect(page.getByRole("tooltip")).toContainText(scenario.rate);

          await page.keyboard.press("Escape");
          await layer.evaluate((element) => (element as { blur(): void }).blur());
          await layer.hover();

          await expect(page.getByRole("tooltip")).toContainText(scenario.rate);

          await page.getByRole("tooltip").hover();

          await expect(page.getByRole("tooltip")).toBeVisible();

          await testInfo.attach("pyramid hover explanation", {
            body: await page.screenshot(),
            contentType: "image/png",
          });
          await page.mouse.move(0, 0);

          await expect(page.getByRole("tooltip")).toHaveCount(0);
          expect(await node.count()).toBeGreaterThan(0);
        }
        await testInfo.attach("input and expected rate", {
          body: JSON.stringify({ frontend, ...scenario }),
          contentType: "application/json",
        });
        await testInfo.attach("chart screenshot", {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
        await page.goto("about:blank");

        await expect(page.getByRole("tooltip")).toHaveCount(0);
      });
    }
  });
}
