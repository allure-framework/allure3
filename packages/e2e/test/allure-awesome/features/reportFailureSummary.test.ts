import { expect, test } from "@playwright/test";
import { epic, feature, label, parameter, Stage, Status, story } from "allure-js-commons";

import { CommonPage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeReportConfig } from "../utils/mocks.js";

test.describe("report failure summary", () => {
  let bootstrap: ReportBootstrap | undefined;
  let commonPage: CommonPage;

  test.beforeEach(async ({ page, browserName }) => {
    bootstrap = undefined;
    commonPage = new CommonPage(page);

    await epic("coverage");
    await feature("Report summary");
    await story("Failure causes");
    await label("coverage", "report-summary");
    await parameter("browser", browserName);
  });

  test.afterEach(async () => {
    await bootstrap?.shutdown();
  });

  test("should summarize every report failure cause", async ({ page }) => {
    const now = Date.now();

    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: "Failed report",
        appendHistory: false,
      }),
      testResults: [
        {
          name: "failed test",
          fullName: "report-summary.failed",
          historyId: "report-summary-failed",
          testCaseId: "report-summary-failed",
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now,
          stop: now + 100,
        },
        {
          name: "broken test",
          fullName: "report-summary.broken",
          historyId: "report-summary-broken",
          testCaseId: "report-summary-broken",
          status: Status.BROKEN,
          stage: Stage.FINISHED,
          start: now + 100,
          stop: now + 200,
        },
      ],
      qualityGateResults: [
        {
          rule: "maxFailures",
          message: "Too many failed tests",
          success: false,
          actual: 2,
          expected: 0,
        },
        {
          rule: "maxDuration",
          message: "Duration is acceptable",
          success: true,
          actual: 200,
          expected: 500,
        },
      ],
      globals: {
        errors: [{ message: "Runner cleanup failed" }],
      },
    });

    await page.goto(bootstrap.url);

    const summary = page.getByTestId("report-failure-summary");

    await expect(summary).toBeVisible();
    await expect(summary.getByTestId("failure-summary-unsuccessful-tests")).toContainText("2");
    await expect(summary.getByTestId("failure-summary-failed-quality-gates")).toContainText("1");
    await expect(summary.getByTestId("failure-summary-global-errors")).toContainText("1");
    await expect(summary).not.toContainText("Process exited with code");
    await commonPage.attachScreenshot();
  });

  test("should explain an exit-code-only report failure", async ({ page }) => {
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: "Exit code failure",
        appendHistory: false,
      }),
      globals: {
        exitCode: { original: 7 },
      },
    });

    await page.goto(bootstrap.url);

    const summary = page.getByTestId("report-failure-summary");

    await expect(summary).toBeVisible();
    await expect(summary.getByTestId("failure-summary-unsuccessful-tests")).toContainText("0");
    await expect(summary.getByTestId("failure-summary-failed-quality-gates")).toContainText("0");
    await expect(summary.getByTestId("failure-summary-global-errors")).toContainText("0");
    await expect(summary).toContainText("Process exited with code 7.");
    await commonPage.attachScreenshot();
  });

  test("should stay hidden for a clean report", async ({ page }) => {
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: "Clean report",
        appendHistory: false,
      }),
      globals: {
        exitCode: { original: 1, actual: 0 },
      },
    });

    await page.goto(bootstrap.url);

    await expect(page.getByTestId("report-failure-summary")).toHaveCount(0);
    await commonPage.attachScreenshot();
  });
});
