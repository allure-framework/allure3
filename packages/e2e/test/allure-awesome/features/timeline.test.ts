import { expect, test } from "@playwright/test";
import { epic, feature, label, Stage, Status, story } from "allure-js-commons";

import { TestResultPage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeReportConfig, makeTestResult } from "../utils/mocks.js";

const selectedTestName = "test selected from timeline";

test.describe("timeline", () => {
  let bootstrap: ReportBootstrap;
  let testResultPage: TestResultPage;

  test.beforeAll(async () => {
    const start = Date.now();
    const timelineLabels = [
      { name: "host", value: "worker-host" },
      { name: "thread", value: "worker-1" },
    ];

    bootstrap = await bootstrapReport(
      {
        reportConfig: makeReportConfig({ name: "Timeline test result navigation" }),
        testResults: [
          makeTestResult({
            uuid: "timeline-selected-test",
            name: selectedTestName,
            fullName: selectedTestName,
            status: Status.FAILED,
            stage: Stage.FINISHED,
            labels: timelineLabels,
            start,
            stop: start + 2_000,
          }),
          makeTestResult({
            uuid: "timeline-other-test",
            name: "other timeline test",
            fullName: "other timeline test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            labels: timelineLabels,
            start: start + 2_500,
            stop: start + 3_500,
          }),
        ],
      },
      { sections: ["timeline"], defaultSection: "timeline" },
    );
  });

  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);
    await epic("coverage");
    await feature("timeline");
    await story("test-result-navigation");
    await label("coverage", "timeline");

    testResultPage = new TestResultPage(page);
    await page.goto(`${bootstrap.url}#/timeline`);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("opens the selected test result from a timeline segment", async ({ page }) => {
    const segment = page.locator(`[data-testid="timeline-segment"][data-test-result-name="${selectedTestName}"]`);

    await expect(segment).toBeVisible();
    const testResultId = await segment.getAttribute("data-test-result-id");

    expect(testResultId).toBeTruthy();
    await segment.click();

    await expect(testResultPage.titleLocator).toHaveText(selectedTestName);
    await expect(testResultPage.statusFailedLocator).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#${testResultId}$`, "u"));
  });
});
