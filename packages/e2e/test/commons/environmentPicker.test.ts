import AwesomePlugin from "@allurereport/plugin-awesome";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { expect, test } from "@playwright/test";
import { feature, label, Status } from "allure-js-commons";

import { bootstrapReport, type ReportBootstrap } from "../utils/index.js";

const longEnvironmentName = "Длинное окружение — " + "环境".repeat(20);
let report: ReportBootstrap;

test.beforeEach(async ({ page, browserName }) => {
  await feature("environment-picker");
  await label("env", browserName);
  await page.route("https://**/*", (route) => route.abort());
});

test.afterEach(async () => {
  await report?.shutdown();
});

for (const frontend of ["awesome", "dashboard"] as const) {
  test(`${frontend} keeps a truncated picker open and focused through pointer and keyboard interaction`, async ({
    page,
  }) => {
    report = await bootstrapReport({
      reportConfig: {
        appendHistory: false,
        environments: {
          long: { name: longEnvironmentName, matcher: () => true },
          short: { name: "Short", matcher: () => false },
        },
        plugins: [
          {
            id: frontend,
            enabled: true,
            options: {},
            plugin:
              frontend === "awesome"
                ? new AwesomePlugin({ singleFile: false })
                : new DashboardPlugin({ singleFile: false }),
          },
        ],
      },
      testResults: [{ name: "sample", fullName: "picker-sample", status: Status.PASSED }],
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 520, height: 850 });
    await page.addInitScript(() => localStorage.setItem("currentEnvironment", '"long"'));
    // Keep Awesome tree-navigation shortcuts outside this picker regression.
    await page.goto(frontend === "awesome" ? new URL("#/charts", report.url).href : report.url);
    const trigger = page.getByTestId("environment-picker-button");
    const tooltip = page.getByTestId("environment-picker-selected-tooltip");
    const menu = page.getByRole("complementary");
    await expect(trigger).toHaveText(longEnvironmentName);
    // Awesome's header keeps its intrinsic width. Constrain the picker owner to
    // exercise the shared truncated state without changing the product layout.
    if (frontend === "awesome") {
      await page.getByTestId("environment-picker").evaluate((element) => {
        element.style.maxWidth = "300px";
      });
    }
    await trigger.hover();
    await expect(tooltip).toBeVisible();

    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(tooltip).toBeHidden();
    await trigger.hover();
    await expect(tooltip).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.press("Enter");
    await expect(menu).toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(tooltip).toBeHidden();
    await menu.getByRole("button", { name: "Short", exact: true }).click();
    await expect(trigger).toHaveText("Short");
    await expect(menu).toBeHidden();

    await trigger.click();
    await menu.getByRole("button", { name: longEnvironmentName, exact: true }).click();
    await expect(trigger).toHaveText(longEnvironmentName);
    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.getByText(/^environment:$/i).click();
    await expect(menu).toBeHidden();

    await page.setViewportSize({ width: 1680, height: 1000 });
    if (frontend === "awesome") {
      await page.getByTestId("environment-picker").evaluate((element) => {
        element.style.maxWidth = "";
      });
    }
    await trigger.hover();
    await expect(tooltip).toBeHidden();
    await trigger.click();
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: /^all$/i }).click();
    await expect(trigger).toHaveText(/^all$/i);
    expect(errors).toEqual([]);
  });
}
