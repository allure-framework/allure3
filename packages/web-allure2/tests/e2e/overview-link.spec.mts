import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { fixtures, REPORT_MODES } from "./support/fixtures.mts";
import { openReport } from "./support/report.mts";

const uiDemo = fixtures.uiDemo;
const translationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/main/javascript/translations",
);

test.describe("Back to overview link", () => {
  test("is rendered in the side navigation when the report has an overview", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { allureReportOptions: unknown }).allureReportOptions = { overviewHref: "../index.html" };
    });
    await openReport(page, { fixture: uiDemo.name, mode: REPORT_MODES.DIRECTORY });

    const link = page.getByTestId("overview-link");

    await expect(link).toHaveAttribute("href", "../index.html");
    await expect(link).toContainText("Back to overview");
    await expect(link).toHaveAttribute("aria-label", "Back to overview");

    await page.locator(".side-nav__collapse").click();
    await expect(page.getByRole("link", { name: "Back to overview" })).toBeVisible();
    await expect(page.locator(".side-nav__menu .side-nav__text")).toHaveText(uiDemo.topLevelTabs);
  });

  test("is not rendered for a single-plugin report", async ({ page }) => {
    await openReport(page, { fixture: uiDemo.name, mode: REPORT_MODES.DIRECTORY });

    await expect(page.locator(".side-nav__menu")).toBeVisible();
    await expect(page.getByTestId("overview-link")).toHaveCount(0);
  });

  test("has a label in every locale", async () => {
    const files = (await fs.readdir(translationsDir)).filter((file) => file.endsWith(".json"));

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const locale = JSON.parse(await fs.readFile(path.join(translationsDir, file), "utf8"));

      expect(typeof locale.controls.backToOverview, file).toBe("string");
    }
  });
});
