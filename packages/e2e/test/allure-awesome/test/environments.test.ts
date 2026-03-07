import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";

import { CommonPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let commonPage: CommonPage;
let treePage: TreePage;

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
};

const longUnicodeEnv = "я".repeat(64);

test.beforeEach(async ({ page, browserName }) => {
  await label("env", browserName);

  commonPage = new CommonPage(page);
  treePage = new TreePage(page);

  bootstrap = await bootstrapReport({
    reportConfig: {
      name: "Sample allure report",
      appendHistory: false,
      knownIssuesPath: undefined,
      variables: {
        env_variable: "unknown",
      },
      environments: {
        foo: {
          variables: {
            env_variable: "foo",
            env_specific_variable: "foo",
          },
          matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "foo"),
        },
        bar: {
          variables: {
            env_variable: "bar",
            env_specific_variable: "bar",
          },
          matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "bar"),
        },
        [longUnicodeEnv]: {
          variables: {
            env_variable: longUnicodeEnv,
          },
          matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === longUnicodeEnv),
        },
      },
    },
    testResults: fixtures.testResults.concat({
      name: "3 sample passed test with long unicode env",
      fullName: "sample.js#3 sample passed test with long unicode env",
      historyId: "4",
      testCaseId: "4",
      status: Status.PASSED,
      stage: Stage.FINISHED,
      start: now + 4000,
      stop: now + 5000,
      labels: [
        {
          name: "env",
          value: longUnicodeEnv,
        },
      ],
    }),
  });

  await page.goto(bootstrap.url);
});

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test.describe("environments", () => {
  // FIXME: the test works locally, but fails on CI; need to find a better way to test the functionality
  test.skip("should render all environment tree sections by default and allow to toggle them", async ({
    page,
    browserName,
  }) => {
    // flaky test, but the feature works as expected
    if (browserName !== "chromium") {
      test.skip();
    }

    const envPicker = page.getByTestId("environment-picker-button");
    const envButtons = page.getByTestId("tree-section-env-button");
    const envButtonsLocators = await envButtons.all();
    const envSections = page.getByTestId("tree-section-env-content");
    const envSectionsLocators = await envSections.all();
    const treeLeaves = page.getByTestId("tree-leaf");

    await expect(envPicker).toHaveText("All");
    await expect(envButtons).toHaveCount(3);
    await expect(envSections).toHaveCount(3);

    for (const envSectionLocator of envSectionsLocators) {
      await expect(envSectionLocator).toBeVisible();
    }

    for (const envButtonLocator of envButtonsLocators) {
      await envButtonLocator.click();
    }

    await expect(envSections).not.toBeVisible();

    for (const envButtonLocator of envButtonsLocators) {
      await envButtonLocator.click();
    }

    for (const envSectionLocator of envSectionsLocators) {
      await expect(envSectionLocator).toBeVisible();
    }

    await expect(treeLeaves).toHaveCount(4);
  });

  test("should allow to switch environments using the picker in the header", async () => {
    await expect(commonPage.envPickerButtonLocator).toHaveText("All");
    await commonPage.selectEnv("foo");
    await expect(treePage.envSectionContentLocator).toHaveCount(0);
    await expect(treePage.envSectionButtonLocator).toHaveCount(0);
    await expect(treePage.leafLocator).toHaveCount(2);
  });

  test("should render statistics for all environments by default", async () => {
    const total = await treePage.getMetadataValue("total");
    const passed = await treePage.getMetadataValue("passed");

    expect(passed).toEqual("5");
    expect(total).toEqual("5");
  });

  test("shouldn't render any environment for test result which doesn't match any environment", async ({ page }) => {
    const envItems = page.getByTestId("test-result-env-item");
    const envTab = page.getByText("Environments");

    await treePage.openTestResultByNthLeaf(0);
    await envTab.click();

    await expect(envItems).toHaveCount(0);
  });

  test("should render a matched environment for test result", async ({ page }) => {
    const envItems = page.getByTestId("test-result-env-item");
    const envTab = page.getByText("Environments");

    await treePage.openTestResultByNthLeaf(1);
    await expect(envTab).toContainText("1");
    await envTab.click();
    await expect(envItems).toHaveCount(1);

    const pageUrl = page.url();
    const envItem = envItems.nth(0);

    await expect(envItem).toContainText("foo");
    await expect(envItems.getByTestId("test-result-env-item-new-tab-button")).not.toBeVisible();
    await envItem.click();
    expect(page.url()).toBe(pageUrl);
  });

  test("should render several environments for test result", async ({ page, context }) => {
    const envItems = page.getByTestId("test-result-env-item");
    const envTab = page.getByText("Environments");

    await commonPage.selectEnv("bar");
    await treePage.openTestResultByNthLeaf(0);
    await expect(envTab).toContainText("2");
    await envTab.click();
    await expect(envItems).toHaveCount(2);

    await expect(envItems.nth(0)).toContainText("foo");
    await expect(envItems.nth(0).getByTestId("test-result-env-item-new-tab-button")).toBeVisible();
    await expect(envItems.nth(1)).toContainText("bar");
    await expect(envItems.nth(1).getByTestId("test-result-env-item-new-tab-button")).not.toBeVisible();

    const pageUrl = page.url();

    expect(context.pages()).toHaveLength(1);
    expect(context.pages()[0].url()).toBe(pageUrl);

    const [newTab] = await Promise.all([
      context.waitForEvent("page"),
      await envItems.nth(0).getByTestId("test-result-env-item-new-tab-button").click(),
    ]);

    expect(context.pages()[0].url()).toBe(pageUrl);
    expect(newTab.url()).not.toBe(pageUrl);
  });

  test("should use different navigations between all environments and a specific one", async ({ page }) => {
    const treeLeaves = page.getByTestId("tree-leaf");
    const navCounter = page.getByTestId("test-result-nav-current");

    await treePage.openTestResultByNthLeaf(0);
    await expect(navCounter).toHaveText("1/5");
    await page.goto(bootstrap.url);
    await commonPage.selectEnv("bar");
    await expect(treeLeaves).toHaveCount(1);
    await treePage.openTestResultByNthLeaf(0);
    await expect(navCounter).toHaveText("1/1");
  });

  test("should render report variables by default", async ({ page }) => {
    const reportVariablesSection = page.getByTestId("report-variables");
    const reportVariablesButton = page.getByTestId("report-variables-button");
    const reportVariablesItems = page.getByTestId("metadata-item");

    await expect(reportVariablesSection).toBeVisible();
    await expect(reportVariablesButton).toContainText("1");
    await expect(reportVariablesItems).toHaveCount(1);
    await expect(reportVariablesItems.nth(0).getByTestId("metadata-item-key")).toHaveText("env_variable");
    await expect(reportVariablesItems.nth(0).getByTestId("metadata-item-value")).toHaveText("unknown");
  });

  test("should render environment variables for a chosen environment", async ({ page }) => {
    const reportVariablesSection = page.getByTestId("report-variables");
    const reportVariablesButton = page.getByTestId("report-variables-button");
    const reportVariablesItems = page.getByTestId("metadata-item");

    await commonPage.selectEnv("foo");
    await expect(reportVariablesSection).toBeVisible();
    await expect(reportVariablesButton).toContainText("2");
    await expect(reportVariablesItems).toHaveCount(2);
    await expect(reportVariablesItems.nth(0).getByTestId("metadata-item-key")).toHaveText("env_variable");
    await expect(reportVariablesItems.nth(0).getByTestId("metadata-item-value")).toHaveText("foo");
    await expect(reportVariablesItems.nth(1).getByTestId("metadata-item-key")).toHaveText("env_specific_variable");
    await expect(reportVariablesItems.nth(1).getByTestId("metadata-item-value")).toHaveText("foo");
  });
});
