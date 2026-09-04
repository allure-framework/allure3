import type { QualityGateValidationResult } from "@allurereport/plugin-api";
import { expect, test } from "@playwright/test";
import { epic, feature, label, parameter, Stage, Status, story } from "allure-js-commons";
import { QualityGatesPage } from "test/pageObjects/QualityGates.js";

import { CommonPage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeReportConfig } from "../utils/mocks.js";

test.describe("quality gates", () => {
  let bootstrap: ReportBootstrap;
  let qualityGatesPage: QualityGatesPage;
  let commonPage: CommonPage;

  test.beforeEach(async ({ page, browserName }) => {
    commonPage = new CommonPage(page);
    qualityGatesPage = new QualityGatesPage(page);

    await feature("Quality Gates");
    await parameter("browser", browserName);
    await epic("coverage");
    await feature("quality-gates");
    await story("qualityGates");
    await label("coverage", "quality-gates");
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

  test("should not render quality gate sections when there're results without any environment", async ({ page }) => {
    const fixture = {
      qualityGateResults: [
        {
          rule: "foo",
          message: "bar",
          success: false,
          actual: 0,
          expected: 0,
        },
        {
          rule: "bar",
          message: "baz",
          success: false,
          actual: 0,
          expected: 0,
        },
      ] as QualityGateValidationResult[],
    };
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: "Test Report",
        appendHistory: false,
      }),
      testResults: [],
      qualityGateResults: fixture.qualityGateResults,
    });

    await page.goto(bootstrap.url);

    await qualityGatesPage.qualityGatesTabLocator.click();

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("2");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(2);
    await expect(qualityGatesPage.qualityGatesResultLocator.nth(0).getByTestId("quality-gate-result-rule")).toHaveText(
      fixture.qualityGateResults[0].rule,
    );
    await expect(
      qualityGatesPage.qualityGatesResultLocator.nth(0).getByTestId("quality-gate-result-message"),
    ).toContainText(fixture.qualityGateResults[0].message);
    await expect(qualityGatesPage.qualityGatesResultLocator.nth(1).getByTestId("quality-gate-result-rule")).toHaveText(
      fixture.qualityGateResults[1].rule,
    );
    await expect(
      qualityGatesPage.qualityGatesResultLocator.nth(1).getByTestId("quality-gate-result-message"),
    ).toContainText(fixture.qualityGateResults[1].message);

    await page.pause();

    await expect(qualityGatesPage.qualityGatesSectionLocator).toHaveCount(0);

    await qualityGatesPage.attachScreenshot();
  });

  test("should render both passed and failed rules of the same run", async ({ page }) => {
    const fixture = {
      qualityGateResults: [
        {
          rule: "successRate",
          message: "Success rate 0.66 is less, than expected 0.9",
          success: false,
          actual: 0.66,
          expected: 0.9,
        },
        {
          rule: "maxFailures",
          message: "The number of failed tests 1 is within the allowed threshold value 2",
          success: true,
          actual: 1,
          expected: 2,
        },
      ] as QualityGateValidationResult[],
    };
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: "Test Report",
        appendHistory: false,
      }),
      testResults: [],
      qualityGateResults: fixture.qualityGateResults,
    });

    await page.goto(bootstrap.url);

    await qualityGatesPage.qualityGatesTabLocator.click();

    // the tab lists every evaluated rule, but the counter reports the failed ones only
    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("1");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(2);
    await expect(qualityGatesPage.qualityGatesFailedResultLocator).toHaveCount(1);
    await expect(qualityGatesPage.qualityGatesPassedResultLocator).toHaveCount(1);

    const failedResult = qualityGatesPage.qualityGatesResultLocator.nth(0);
    const passedResult = qualityGatesPage.qualityGatesResultLocator.nth(1);

    await expect(failedResult.getByTestId("quality-gate-result-rule")).toHaveText("successRate");
    await expect(failedResult.getByTestId("quality-gate-result-message")).toContainText(
      fixture.qualityGateResults[0].message,
    );
    await expect(passedResult.getByTestId("quality-gate-result-rule")).toHaveText("maxFailures");
    await expect(passedResult.getByTestId("quality-gate-result-message")).toContainText(
      fixture.qualityGateResults[1].message,
    );

    await qualityGatesPage.attachScreenshot();
  });

  test("should render quality gate sections with environments from validation results", async ({ page }) => {
    const fixture = {
      qualityGateResults: [
        {
          rule: "foo",
          message: "bar",
          success: false,
          actual: 0,
          expected: 0,
          environment: "foo",
        },
        {
          rule: "bar",
          message: "baz",
          success: false,
          actual: 0,
          expected: 0,
          environment: "bar",
        },
      ] as QualityGateValidationResult[],
    };
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: "Test Report",
        appendHistory: false,
      }),
      testResults: [],
      qualityGateResults: fixture.qualityGateResults,
    });

    await page.goto(bootstrap.url);

    await qualityGatesPage.qualityGatesTabLocator.click();

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("2");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(2);
    await expect(qualityGatesPage.qualityGatesResultLocator.nth(0).getByTestId("quality-gate-result-rule")).toHaveText(
      fixture.qualityGateResults[0].rule,
    );
    await expect(
      qualityGatesPage.qualityGatesResultLocator.nth(0).getByTestId("quality-gate-result-message"),
    ).toContainText(fixture.qualityGateResults[0].message);
    await expect(qualityGatesPage.qualityGatesResultLocator.nth(1).getByTestId("quality-gate-result-rule")).toHaveText(
      fixture.qualityGateResults[1].rule,
    );
    await expect(
      qualityGatesPage.qualityGatesResultLocator.nth(1).getByTestId("quality-gate-result-message"),
    ).toContainText(fixture.qualityGateResults[1].message);
    await expect(qualityGatesPage.qualityGatesSectionLocator).toHaveCount(2);

    await qualityGatesPage.attachScreenshot();
  });

  test("should allow to switch between environments to see certain quality gate results", async ({ page }) => {
    const now = Date.now();
    const fixtures = {
      testResults: [
        {
          name: "0 sample passed test",
          fullName: "sample.js#0 sample passed test",
          historyId: "1",
          testCaseId: "1",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now,
          stop: now + 1000,
        },
        {
          name: "1 sample passed test",
          fullName: "sample.js#1 sample passed test",
          historyId: "2",
          testCaseId: "2",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now + 1000,
          stop: now + 2000,
          labels: [
            {
              name: "env",
              value: "foo",
            },
          ],
        },
        {
          name: "2 sample passed test",
          fullName: "sample.js#2 sample passed test",
          historyId: "3",
          testCaseId: "3",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now + 2000,
          stop: now + 3000,
          labels: [
            {
              name: "env",
              value: "foo",
            },
          ],
        },
        {
          name: "2 sample passed test",
          fullName: "sample.js#2 sample passed test",
          historyId: "3",
          testCaseId: "3",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now + 3000,
          stop: now + 4000,
          labels: [
            {
              name: "env",
              value: "bar",
            },
          ],
        },
      ],
      qualityGateResults: [
        {
          rule: "foo",
          message: "bar",
          success: false,
          actual: 0,
          expected: 0,
          environment: "foo",
        },
        {
          rule: "bar",
          message: "baz",
          success: false,
          actual: 0,
          expected: 0,
          environment: "bar",
        },
      ] as QualityGateValidationResult[],
    };
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: "Test Report",
        appendHistory: false,
        environments: {
          foo: {
            matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "foo"),
          },
          bar: {
            matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "bar"),
          },
        },
      }),
      testResults: fixtures.testResults,
      qualityGateResults: fixtures.qualityGateResults,
    });

    await page.goto(bootstrap.url);

    await qualityGatesPage.qualityGatesTabLocator.click();

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("2");

    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(2);
    await expect(qualityGatesPage.qualityGatesSectionLocator).toHaveCount(2);

    await commonPage.selectEnv("foo");

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("1");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(1);
    await expect(qualityGatesPage.qualityGatesSectionLocator).toHaveCount(0);

    await commonPage.selectEnv("bar");

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("1");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(1);
    await expect(qualityGatesPage.qualityGatesSectionLocator).toHaveCount(0);

    await commonPage.selectEnv("default");

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("0");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(0);
    await expect(qualityGatesPage.qualityGatesSectionLocator).toHaveCount(0);

    await qualityGatesPage.attachScreenshot();
  });
});
