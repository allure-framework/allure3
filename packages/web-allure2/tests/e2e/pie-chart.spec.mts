import { expect, test, type Page } from "@playwright/test";

import { REPORT_MODES } from "./support/fixtures.mts";
import { openReport } from "./support/report.mts";

type Counts = Partial<Record<"passed" | "failed" | "broken" | "skipped" | "unknown", number>>;

const overrideStatistics = async (page: Page, counts: Counts) => {
  const statistic = { ...counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };

  await page.route("**/widgets/summary.json*", async (route) => {
    const response = await route.fetch();

    await route.fulfill({ json: { ...(await response.json()), statistic } });
  });
  await page.route("**/widgets/status-chart.json*", (route) =>
    route.fulfill({
      json: {
        items: Object.entries(counts).flatMap(([status, count]) => Array.from({ length: count }, () => ({ status }))),
      },
    }),
  );
};

for (const mode of Object.values(REPORT_MODES)) {
  test(`pie explanation and interaction in both chart locations (${mode})`, async ({ page }, testInfo) => {
    await openReport(page, { fixture: "success-rate", mode });

    for (const route of ["", "graph"]) {
      if (route) {
        await page.locator('a[href="#graph"]').click();
      }

      const caption = page.locator('.chart__caption[data-tooltip-key="caption"]');

      await expect(caption).toHaveText("91.63%");
      await expect(caption).toHaveAccessibleName("Success rate: 91.63%");
      await expect(caption).toHaveAccessibleDescription(/Skipped and unknown tests are excluded/);

      await test.step("Focus explanation; Escape dismisses without moving focus", async () => {
        await caption.focus();

        await expect(page.getByRole("tooltip")).toHaveText("Success rate: 91.63%");

        await page.keyboard.press("Escape");

        await expect(page.getByRole("tooltip")).toHaveCount(0);
        await expect(caption).toBeFocused();
      });
      await test.step("Pointer can enter explanation, and leaving both targets closes it", async () => {
        await caption.evaluate((element) => (element as SVGElement & { blur(): void }).blur());
        await caption.hover();

        const tooltip = page.getByRole("tooltip");

        await expect(tooltip).toBeVisible();

        await tooltip.hover();

        await expect(tooltip).toBeVisible();

        await page.mouse.move(0, 0);

        await expect(tooltip).toHaveCount(0);
      });
      await test.step("Slice and legend use all tests as denominator", async () => {
        const slice = page.locator(".chart__arc_status_passed");

        await slice.focus();

        await expect(page.getByRole("tooltip")).toHaveText("493 Passed (77.88% of all tests)");

        if (route) {
          await page.locator('.chart__legend-row[data-status="passed"]').focus();

          await expect(page.getByRole("tooltip")).toHaveCount(1);
          await expect(page.getByRole("tooltip")).toHaveText("493 Passed (77.88% of all tests)");

          await page.locator('.chart__legend-row[data-status="unknown"]').focus();

          await expect(page.getByRole("tooltip")).toHaveCount(1);
          await expect(page.getByRole("tooltip")).toContainText("0 Unknown (0% of all tests)");
        }
        await page.keyboard.press("Escape");
      });

      await caption.focus();
      await page.setViewportSize({ width: route ? 1300 : 1200, height: 900 });

      await expect(caption).toBeFocused();
      await expect(page.getByRole("tooltip")).toContainText("91.63%");

      await testInfo.attach(`chart ${route || "overview"}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      await page.keyboard.press("Escape");
      await caption.evaluate((element) => (element as SVGElement & { blur(): void }).blur());
    }

    await testInfo.attach("input and expectations", {
      body: JSON.stringify({ passed: 493, failed: 45, skipped: 95, success: "91.63%", passedSlice: "77.88%" }),
      contentType: "application/json",
    });
    await page.locator('a[href="#suites"]').click();

    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(page.locator('[id*="-description-"]')).toHaveCount(0);
  });
}

for (const scenario of [
  {
    name: "mixed broken and unknown",
    counts: { passed: 2, failed: 1, broken: 1, skipped: 2, unknown: 2 },
    rate: "50%",
    explanation: "Calculated from",
  },
  { name: "no passed results", counts: { failed: 1, broken: 1 }, rate: "0%", explanation: "Calculated from" },
  {
    name: "skipped only",
    counts: { skipped: 3 },
    rate: "0%",
    explanation: "There are no passed, failed, or broken tests.",
  },
  {
    name: "unknown only",
    counts: { unknown: 3 },
    rate: "0%",
    explanation: "There are no passed, failed, or broken tests.",
  },
  { name: "empty", counts: {}, rate: "???", explanation: "There are no test results." },
]) {
  test(`pie state: ${scenario.name}`, async ({ page }, testInfo) => {
    await overrideStatistics(page, scenario.counts);
    await openReport(page, { fixture: "success-rate", mode: REPORT_MODES.DIRECTORY });

    for (const route of ["", "graph"]) {
      if (route) {
        await page.locator('a[href="#graph"]').click();
      }

      const caption = page.locator(".chart__caption");

      await expect(caption).toHaveText(scenario.rate);
      await expect(caption).toHaveAccessibleDescription(new RegExp(scenario.explanation));

      await caption.focus();

      await expect(page.getByRole("tooltip")).toHaveText(`Success rate: ${scenario.rate}`);

      await testInfo.attach(`${route || "overview"} state`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
      await page.keyboard.press("Escape");
    }

    await testInfo.attach("input and expected state", {
      body: JSON.stringify(scenario),
      contentType: "application/json",
    });
  });
}

test("French explanation and singular count", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("ALLURE_REPORT_SETTINGS", JSON.stringify({ language: "fr" })));
  await overrideStatistics(page, { passed: 1, skipped: 1 });
  await openReport(page, { fixture: "success-rate", mode: REPORT_MODES.DIRECTORY });

  const caption = page.locator(".chart__caption");

  await expect(caption).toHaveAccessibleName("Taux de réussite : 100%");

  await caption.focus();

  await expect(page.getByRole("tooltip")).toHaveText("Taux de réussite : 100%");

  await page.locator(".chart__arc_status_passed").focus();

  await expect(page.getByRole("tooltip")).toHaveCount(1);
  await expect(page.getByRole("tooltip")).toContainText("1 Passé (50% de tous les tests)");

  await testInfo.attach("French chart", { body: await page.screenshot(), contentType: "image/png" });
});
