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
          success: true,
          actual: 0,
          expected: 0,
        },
        {
          rule: "bar",
          message: "baz",
          success: true,
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

  test("should render quality gate sections with environments from validation results", async ({ page }) => {
    const fixture = {
      qualityGateResults: [
        {
          rule: "foo",
          message: "bar",
          success: true,
          actual: 0,
          expected: 0,
          environment: "foo",
        },
        {
          rule: "bar",
          message: "baz",
          success: true,
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
          success: true,
          actual: 0,
          expected: 0,
          environment: "foo",
        },
        {
          rule: "bar",
          message: "baz",
          success: true,
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
    // while a single environment is selected every bucket keeps its header, it tells the results of
    // that environment apart from the shared ones
    await expect(qualityGatesPage.qualityGatesSectionLocator).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Environment: "foo"/ })).toBeVisible();

    await commonPage.selectEnv("bar");

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("1");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(1);
    await expect(qualityGatesPage.qualityGatesSectionLocator).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Environment: "bar"/ })).toBeVisible();

    await commonPage.selectEnv("default");

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("0");
    await expect(qualityGatesPage.qualityGatesResultLocator).toHaveCount(0);
    await expect(qualityGatesPage.qualityGatesSectionLocator).toHaveCount(0);

    await qualityGatesPage.attachScreenshot();
  });

  test("should keep quality gate results without an environment visible for every environment", async ({ page }) => {
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
          labels: [{ name: "env", value: "foo" }],
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
          labels: [{ name: "env", value: "bar" }],
        },
      ],
      qualityGateResults: [
        {
          rule: "maxFailures",
          message: "global gate failure",
          success: false,
          actual: 1,
          expected: 0,
        },
        {
          rule: "minTestsCount",
          message: "foo gate failure",
          success: false,
          actual: 0,
          expected: 1,
          environment: "foo",
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

    // the gate failure without an environment isn't environment specific, so it stays visible next
    // to the results of the selected environment
    await commonPage.selectEnv("foo");

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("2");
    await expect(page.getByText("foo gate failure")).toBeVisible();
    await expect(page.getByText("global gate failure")).toBeVisible();
    await expect(page.getByRole("button", { name: /Environment: "foo"/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Environment: "default"/ })).toBeVisible();

    await commonPage.selectEnv("bar");

    await expect(qualityGatesPage.qualityGatesTabLocator).toContainText("1");
    await expect(page.getByText("global gate failure")).toBeVisible();
    await expect(page.getByText("foo gate failure")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Environment: "default"/ })).toBeVisible();

    await qualityGatesPage.attachScreenshot();
  });
});
