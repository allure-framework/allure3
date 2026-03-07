import { fallbackTestCaseIdLabelName } from "@allurereport/core-api";
import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeReportConfig, makeTestResult, makeTestResultNames } from "../utils/mocks.js";

const reportName = "Sample allure report";
const fallbackTestCaseId = "legacy-test-case-id";
const { name: testName, fullName: testFullName } = makeTestResultNames("test with hidden fallback label");

test.describe("hideLabels", () => {
  let bootstrap: ReportBootstrap;

  test.beforeAll(async () => {
    const testResults = [
      makeTestResult({
        name: testName,
        fullName: testFullName,
        status: Status.PASSED,
        stage: Stage.FINISHED,
        labels: [
          { name: "owner", value: "qa-team" },
          { name: "_internalLabel", value: "secret-value" },
          { name: fallbackTestCaseIdLabelName, value: fallbackTestCaseId },
        ],
      }),
    ];

    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: reportName,
      }),
      testResults,
    });
  });

  test.beforeEach(async ({ browserName }) => {
    await label("env", browserName);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("should hide underscore-prefixed labels by default and keep metadata counter in sync", async ({ page }) => {
    await page.goto(bootstrap.url);

    const treePage = new TreePage(page);
    await expect(treePage.getLeafByTitle(testName)).toBeVisible();
    await treePage.getLeafByTitle(testName).click();

    const testResultPage = new TestResultPage(page);
    await expect(testResultPage.titleLocator).toHaveText(testName);

    const metadataItems = page.getByTestId("metadata-item");
    await expect(metadataItems).toHaveCount(1);
    await expect(page.getByTestId("metadata-item-key").filter({ hasText: "owner" })).toBeVisible();
    await expect(page.getByTestId("metadata-item-key").filter({ hasText: "_internalLabel" })).toHaveCount(0);
    await expect(page.getByTestId("metadata-item-key").filter({ hasText: fallbackTestCaseIdLabelName })).toHaveCount(0);

    const labelsButton = page.getByRole("button").filter({ hasText: "Labels" }).first();
    await expect(labelsButton.getByTestId("counter")).toHaveText("1");
  });
});
