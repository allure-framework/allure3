import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ReportTestResult, TestResultRegistry } from "@allurereport/plugin-api";
import AwesomePlugin from "@allurereport/plugin-awesome";
import ClassicPlugin from "@allurereport/plugin-classic";
import DashboardPlugin from "@allurereport/plugin-dashboard";
import { expect, test } from "@playwright/test";
import { feature, label, step, Status, Stage } from "allure-js-commons";

import { bootstrapReport, type ReportBootstrap } from "../utils/index.js";

for (const singleFile of [false, true]) {
  test.describe(singleFile ? "single-file result links" : "directory result links", () => {
    let report: ReportBootstrap;
    let earlierId: string;
    let currentId: string;

    test.beforeAll(async () => {
      report = await bootstrapReport({
        reportConfig: {
          appendHistory: false,
          plugins: [
            {
              id: "awesome",
              enabled: true,
              options: {},
              plugin: new AwesomePlugin({ singleFile, sections: ["timeline", "charts"], defaultSection: "timeline" }),
            },
            { id: "classic", enabled: true, options: {}, plugin: new ClassicPlugin({ singleFile }) },
            { id: "dashboard", enabled: true, options: {}, plugin: new DashboardPlugin({ singleFile }) },
          ],
        },
        rawTestResults: [
          {
            uuid: "routing-earlier",
            name: "Earlier attempt",
            fullName: "routing-test",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: 1000,
            stop: 1100,
          },
          {
            uuid: "routing-current",
            name: "Current attempt",
            fullName: "routing-test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 2000,
            stop: 2100,
          },
        ],
      });

      const registry: TestResultRegistry = JSON.parse(
        await readFile(join(report.reportDir, "test-results.json"), "utf8"),
      );
      const current = Object.values(registry.byId).find(({ name }) => name === "Current attempt");
      expect(current).toBeDefined();
      currentId = current!.id;

      const resultPath = `data/test-results/${currentId}.json`;
      let resultJson: string;
      if (singleFile) {
        const html = await readFile(join(report.reportDir, "awesome/index.html"), "utf8");
        const encoded = [...html.matchAll(/d\("([^"]+)","([A-Za-z0-9+/=]+)"\)/g)].find(
          ([, name]) => name === resultPath,
        )?.[2];
        expect(encoded).toBeDefined();
        resultJson = Buffer.from(encoded!, "base64").toString("utf8");
      } else {
        resultJson = await readFile(join(report.reportDir, "awesome", resultPath), "utf8");
      }
      const currentResult: ReportTestResult = JSON.parse(resultJson);
      const earlier = currentResult.retries?.find(({ name }) => name === "Earlier attempt");
      expect(earlier).toBeDefined();
      earlierId = earlier!.id;
    });

    test.afterAll(async () => report?.shutdown());
    test.beforeEach(async ({ browserName, page }) => {
      await feature("test-result-routing");
      await label("env", browserName);
      await page.route("https://**/*", (route) => route.abort());
    });

    test("awesome applies the configured default only when opening the root", async ({ page }) => {
      const url = new URL("/awesome/index.html?keep=value", report.url);
      await page.goto(url.href);
      await expect(page).toHaveURL(`${url.href}#timeline`);
      await expect(page.locator("html")).toHaveAttribute("data-section", "timeline");

      url.hash = "charts";
      await page.goto(url.href);
      await expect(page).toHaveURL(url.href);
      await expect(page.locator("html")).toHaveAttribute("data-section", "charts");

      url.hash = "categories";
      await page.goto(url.href);
      await expect(page).toHaveURL(url.href);
      await expect(page.locator("html")).toHaveAttribute("data-section", "default");
    });

    if (!singleFile) {
      for (const resultPath of ["testresult", "suites/root"]) {
        test(`classic keeps ${resultPath} selected after an older request fails`, async ({ page }, testInfo) => {
          const missingId = "0".repeat(32);
          let markRequested = () => {};
          let release = () => {};
          const requested = new Promise<void>((resolve) => {
            markRequested = resolve;
          });
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.route(`**/data/test-results/${missingId}.json`, async (route) => {
            markRequested();
            await held;
            await route.fulfill({ status: 404, body: "Not found" });
          });
          const url = new URL(`/classic/index.html#${resultPath}/${missingId}`, report.url);
          try {
            await page.goto(url.href);
            await requested;
            await page.evaluate(
              ({ path, id }) => {
                location.hash = `${path}/${id}`;
              },
              { path: resultPath, id: currentId },
            );
            const title = page.getByTestId("test-result-info-title");
            await expect(title).toHaveText("Current attempt");

            await step("Complete the previous failed request after the current result is visible", async () => {
              const response = page.waitForResponse((item) => item.url().endsWith(`${missingId}.json`));
              release();
              await (await response).finished();
              await testInfo.attach("Current result after stale failure", {
                body: await page.screenshot(),
                contentType: "image/png",
              });
              await expect(title).toHaveText("Current attempt");
              await expect(page.getByText("No test case results", { exact: true })).toHaveCount(0);
              await expect(page).toHaveURL(new RegExp(`#${resultPath}/${currentId}$`));
              expect(errors).toEqual([]);
            });
          } finally {
            release();
          }
        });
      }
    }

    for (const frontend of ["awesome", "classic"] as const) {
      test(`${frontend} opens exact attempts and handles hash changes and browser history`, async ({ page }) => {
        const url = new URL(`/${frontend}/index.html?keep=value`, report.url);
        url.hash = `testresult/${earlierId}/`;
        const title = page.getByTestId("test-result-info-title");

        await step("Open the earlier retry through the common link and reload", async () => {
          await page.goto(url.href);
          await expect(title).toHaveText("Earlier attempt");
          await page.reload();
          await expect(title).toHaveText("Earlier attempt");
        });

        await step("Change result without reloading and navigate Back and Forward", async () => {
          await page.evaluate((id) => {
            location.hash = `testresult/${id}`;
          }, currentId);
          await expect(title).toHaveText("Current attempt");
          await page.goBack();
          await expect(title).toHaveText("Earlier attempt");
          await page.goForward();
          await expect(title).toHaveText("Current attempt");
        });

        await step("Open the short compatibility link without adding a redirect history entry", async () => {
          const length = await page.evaluate(() => history.length);
          await page.evaluate((id) => {
            location.hash = id;
          }, earlierId);
          await expect(title).toHaveText("Earlier attempt");
          expect(await page.evaluate(() => history.length)).toBe(length + 1);
          expect(new URL(page.url()).search).toBe("?keep=value");
          await page.goBack();
          await expect(title).toHaveText("Current attempt");
          url.hash = earlierId;
          await page.goto(url.href);
          await expect(title).toHaveText("Earlier attempt");
        });

        await step("Keep the result tab through navigation and reload", async () => {
          const tab = frontend === "classic" ? "retries" : "history";
          url.hash = `testresult/${currentId}`;
          await page.goto(url.href);
          await page.getByTestId(`test-result-tab-${tab}`).click();
          await expect(page).toHaveURL(new RegExp(`#testresult/${currentId}/${tab}$`));
          await page.reload();
          await expect(title).toHaveText("Current attempt");
          await expect(page.getByTestId(`test-result-tab-${tab}`)).toHaveAttribute("aria-current", "true");
        });

        await step("Keep the missing-result state instead of redirecting to the root", async () => {
          url.hash = `testresult/${"0".repeat(32)}`;
          await page.goto(url.href);
          await expect(title).toHaveCount(0);
          await expect(
            page.getByText(frontend === "classic" ? "No test case results" : /Failed to fetch/).first(),
          ).toBeVisible();
          await expect(page).toHaveURL(url.href);
        });
      });
    }

    for (const frontend of ["dashboard", "overview"] as const) {
      test(`${frontend} replaces result links with its own root and preserves other fragments`, async ({ page }) => {
        const url = new URL(frontend === "overview" ? "/index.html" : "/dashboard/index.html", report.url);
        url.search = "?keep=value&keep=second";
        const root = url.href;
        url.hash = `testresult/${earlierId}/`;

        await step("Fall back on initial open and subsequent short links", async () => {
          await page.goto(url.href);
          await expect(page).toHaveURL(root);
          await expect(page.locator("#app")).not.toBeEmpty();
          const length = await page.evaluate(() => history.length);
          await page.evaluate((id) => {
            location.hash = id;
          }, currentId);
          await expect(page).toHaveURL(root);
          expect(await page.evaluate(() => history.length)).toBe(length + 1);
          await page.goBack();
          await expect(page).toHaveURL(root);
          await page.goForward();
          await expect(page).toHaveURL(root);
        });

        await step("Leave unrelated fragments unchanged", async () => {
          await page.evaluate(() => {
            location.hash = "unrelated";
          });
          await expect(page).toHaveURL(`${root}#unrelated`);
        });
      });
    }
  });
}
