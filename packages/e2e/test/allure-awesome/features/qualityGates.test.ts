import { QualityGateValidationResult } from "@allurereport/plugin-api";
import { expect, test } from "@playwright/test";
import { feature, parameter } from "allure-js-commons";
import { QualityGatesPage } from "test/pageObjects/QualityGates.js";
import { GlobalsPage, TestResultPage } from "../../pageObjects";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeReportConfig } from "../utils/mocks.js";

test.describe("quality gates", () => {
  let bootstrap: ReportBootstrap;
  let qualityGatesPage: QualityGatesPage;

  test.beforeEach(async ({ page, browserName }) => {
    qualityGatesPage = new QualityGatesPage(page);

    await feature("Quality Gates");
    await parameter("browser", browserName);
  });

  test.afterEach(async () => {
    await bootstrap.shutdown();
  });

  test("should render empty quality gate tab when there is no quality gate validation results", async ({ page }) => {
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: "Test Report",
        appendHistory: false,
      }),
      testResults: [],
      qualityGateResults: [],
    });

    await page.goto(bootstrap.url);

    await qualityGatesPage.qualityGatesTabLocator.click();

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("0");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(0);

    await qualityGatesPage.attachScreenshot();
  });

  test("should render empty quality gate tab", async ({ page }) => {
    const fixture = {
      rules: [
        {
          rule: "foo",
          message: "bar",
        },
        {
          rule: "bar",
          message: "baz",
        },
      ] as QualityGateValidationResult[],
    };
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: "Test Report",
        appendHistory: false,
      }),
      testResults: [],
      qualityGateResults: fixture.rules,
    });

    await page.goto(bootstrap.url);

    await qualityGatesPage.qualityGatesTabLocator.click();

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("2");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(2);
    await expect(
      qualityGatesPage.qualityGatesResultLocator.nth(0).getByTestId("report-quality-gate-result-rule"),
    ).toHaveText(fixture.rules[0].rule);
    await expect(
      qualityGatesPage.qualityGatesResultLocator.nth(0).getByTestId("report-quality-gate-result-message"),
    ).toContainText(fixture.rules[0].message);
    await expect(
      qualityGatesPage.qualityGatesResultLocator.nth(1).getByTestId("report-quality-gate-result-rule"),
    ).toHaveText(fixture.rules[1].rule);
    await expect(
      qualityGatesPage.qualityGatesResultLocator.nth(1).getByTestId("report-quality-gate-result-message"),
    ).toContainText(fixture.rules[1].message);

    await qualityGatesPage.attachScreenshot();
  });
});
