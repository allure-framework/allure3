import { expect, test } from "@playwright/test";
import { epic, feature, label, Stage, Status, story } from "allure-js-commons";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

test.beforeEach(async ({ browserName, page }) => {
  await label("env", browserName);
  await epic("coverage");
  await feature("ui-state");
  await story("tree");
  await label("coverage", "ui-state");
  treePage = new TreePage(page);
  testResultPage = new TestResultPage(page);

  if (bootstrap) {
    await page.goto(bootstrap.url);
  }
});

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test.describe("commons", () => {
  test.beforeAll(async () => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
        },
        testResults: [
          {
            name: "0 sample passed test",
            fullName: "sample.js#0 sample passed test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 1000,
            labels: [
              { name: "owner", value: "Igor Martynov" },
              { name: "feature", value: "Forms" },
              { name: "tag", value: "smoke" },
            ],
            parameters: [{ name: "browser", value: "chromium", hidden: false, masked: false, excluded: false }],
          },
          {
            name: "1 sample failed test",
            fullName: "sample.js#1 UniqueFailedFullName",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: 5000,
            statusDetails: {
              message: "Assertion error: Expected 1 to be 2",
              trace: "failed test trace",
            },
          },
          {
            name: "2 sample broken test",
            fullName: "sample.js#2 sample broken test",
            status: Status.BROKEN,
            stage: Stage.FINISHED,
            start: 10000,
            statusDetails: {
              message: "An unexpected error",
              trace: "broken test trace",
            },
          },
          {
            name: "3 sample skipped test",
            fullName: "sample.js#3 sample skipped test",
            start: 15000,
            status: Status.SKIPPED,
          },
          {
            name: "4 sample unknown test",
            fullName: "sample.js#4 sample unknown test",
            status: undefined,
            start: 20000,
            stage: Stage.PENDING,
          },
        ],
      },
      {
        groupBy: ["parentSuite", "suite", "subSuite"],
      },
    );
  });

  test("all types of tests are displayed", async () => {
    await expect(treePage.leafLocator).toHaveCount(5);

    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");
    await expect(treePage.getNthLeafPassedStatusLocator(0)).toBeVisible();
    await expect(treePage.getNthLeafOrderLocator(0)).toHaveText("1");

    await expect(treePage.getNthLeafTitleLocator(1)).toHaveText("1 sample failed test");
    await expect(treePage.getNthLeafFailedStatusLocator(1)).toBeVisible();
    await expect(treePage.getNthLeafOrderLocator(1)).toHaveText("2");

    await expect(treePage.getNthLeafTitleLocator(2)).toHaveText("2 sample broken test");
    await expect(treePage.getNthLeafBrokenStatusLocator(2)).toBeVisible();
    await expect(treePage.getNthLeafOrderLocator(2)).toHaveText("3");

    await expect(treePage.getNthLeafTitleLocator(3)).toHaveText("3 sample skipped test");
    await expect(treePage.getNthLeafSkippedStatusLocator(3)).toBeVisible();
    await expect(treePage.getNthLeafOrderLocator(3)).toHaveText("4");

    await expect(treePage.getNthLeafTitleLocator(4)).toHaveText("4 sample unknown test");
    await expect(treePage.getNthLeafUnknownStatusLocator(4)).toBeVisible();
    await expect(treePage.getNthLeafOrderLocator(4)).toHaveText("5");
  });

  test("statistics in metadata renders information about the tests", async () => {
    const stats = await treePage.getMetadataValues();

    expect(stats).toMatchObject({
      total: "5",
      passed: "1",
      failed: "1",
      broken: "1",
      skipped: "1",
      unknown: "1",
    });
  });

  test("tree tabs filter tests by the status", async () => {
    await expect(treePage.leafLocator).toHaveCount(5);

    await treePage.clickTreeTab("passed");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");

    await treePage.clickTreeTab("failed");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("1 sample failed test");

    await treePage.clickTreeTab("broken");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("2 sample broken test");

    await treePage.clickTreeTab("skipped");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("3 sample skipped test");

    await treePage.clickTreeTab("unknown");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("4 sample unknown test");

    await treePage.clickTreeTab("all");
    await expect(treePage.leafLocator).toHaveCount(5);
  });

  test("test result page opens after test result click", async () => {
    await treePage.clickNthLeaf(0);
    await expect(testResultPage.titleLocator).toHaveText("0 sample passed test");
    await expect(testResultPage.fullnameLocator).toHaveText("sample.js#0 sample passed test");
    await expect(testResultPage.statusPassedLocator).toBeVisible();
  });

  test("search filters tests on typing", async () => {
    await expect(treePage.leafLocator).toHaveCount(5);
    await treePage.searchTree("sample passed");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");
  });

  test("search filters tests by full name, owner, tag, parameter, and error message", async () => {
    await treePage.searchTree("UniqueFailedFullName");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("1 sample failed test");

    await treePage.searchTree("Igor Martynov");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");

    await treePage.searchTree("feature:Forms");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");

    await treePage.searchTree("smoke");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");

    await treePage.searchTree("browser:chromium");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");

    await treePage.searchTree("An unexpected");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("2 sample broken test");
  });

  test("search works together with status filters", async () => {
    await treePage.clickTreeTab("failed");
    await expect(treePage.leafLocator).toHaveCount(1);

    await treePage.searchTree("An unexpected");
    await expect(treePage.leafLocator).toHaveCount(0);

    await treePage.searchTree("Assertion error");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("1 sample failed test");
  });

  test("should clear all active filters with one action", async ({ page }) => {
    await treePage.clickTreeTab("failed");
    await treePage.searchTree("Assertion error");
    await expect(page).toHaveURL(/[?&]query=/);
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.clearFiltersButtonLocator).toBeVisible();

    await treePage.clickClearFiltersButton();

    await expect(treePage.leafLocator).toHaveCount(5);
    await expect(treePage.clearFiltersButtonLocator).not.toBeVisible();
    await expect(treePage.searchLocator).toHaveValue("");
    await expect(page).toHaveURL(bootstrap.url);
  });
});

test.describe("SearchBox component with debounce", () => {
  test("should update value with debounce and clear input", async ({ page }) => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
        },
        history: [],
        testResults: [
          {
            name: "0 sample passed test",
            fullName: "sample.js#0 sample passed test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 1000,
            labels: [{ name: "story", value: "foo" }],
          },
          {
            name: "1 sample failed test",
            fullName: "sample.js#1 sample failed test",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: 5000,
            statusDetails: {
              message: "Assertion error: Expected 1 to be 2",
              trace: "failed test trace",
            },
          },
        ],
      },
      {
        groupBy: ["story"],
      },
    );

    await page.goto(bootstrap.url);

    await expect(treePage.searchLocator).toHaveValue("");
    await treePage.searchTree("i am input");
    await page.waitForTimeout(350);
    await expect(treePage.searchLocator).toHaveValue("i am input");
    await treePage.searchClear();
    await expect(treePage.searchLocator).toHaveValue("");
  });
});

test.describe("suites", () => {
  test("should compact a chain of suites into one group", async ({ page }) => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
        },
        testResults: [
          {
            name: "0 sample passed test",
            fullName: "sample.js#0 sample passed test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 1000,
            labels: [
              { name: "parentSuite", value: "foo" },
              {
                name: "suite",
                value: "bar",
              },
              { name: "subSuite", value: "baz" },
            ],
          },
          {
            name: "1 sample failed test",
            fullName: "sample.js#1 sample failed test",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: 5000,
            statusDetails: {
              message: "Assertion error: Expected 1 to be 2",
              trace: "failed test trace",
            },
          },
        ],
      },
      {
        groupBy: ["parentSuite", "suite", "subSuite"],
      },
    );

    await page.goto(bootstrap.url);

    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.sectionsLocator).toHaveCount(1);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("foo / bar / baz");
    await treePage.toggleNthSection(0);

    await expect(treePage.leafLocator).toHaveCount(2);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");
    await expect(treePage.getNthLeafOrderLocator(0)).toHaveText("1");
    await expect(treePage.getNthLeafTitleLocator(1)).toHaveText("1 sample failed test");
    await expect(treePage.getNthLeafOrderLocator(1)).toHaveText("1");
  });

  test("should not display groups when test results don't have related label", async ({ page }) => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
        },
        testResults: [
          {
            name: "0 sample passed test",
            fullName: "sample.js#0 sample passed test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 1000,
            labels: [
              {
                name: "suite",
                value: "foo",
              },
              { name: "subSuite", value: "bar" },
            ],
          },
          {
            name: "1 sample failed test",
            fullName: "sample.js#1 sample failed test",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: 5000,
            statusDetails: {
              message: "Assertion error: Expected 1 to be 2",
              trace: "failed test trace",
            },
          },
        ],
      },
      {
        groupBy: ["parentSuite", "suite", "subSuite"],
      },
    );

    await page.goto(bootstrap.url);

    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.sectionsLocator).toHaveCount(1);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("foo / bar");
    await treePage.toggleNthSection(0);

    await expect(treePage.sectionsLocator).toHaveCount(1);
    await expect(treePage.leafLocator).toHaveCount(2);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");
    await expect(treePage.getNthLeafOrderLocator(0)).toHaveText("1");
    await expect(treePage.getNthLeafTitleLocator(1)).toHaveText("1 sample failed test");
    await expect(treePage.getNthLeafOrderLocator(1)).toHaveText("1");
  });

  test("should assign default labels when test results don't any matched one label", async ({ page }) => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,

          defaultLabels: {
            parentSuite: "Assign me please!",
          },
        },
        testResults: [
          {
            name: "0 sample passed test",
            fullName: "sample.js#0 sample passed test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 1000,
            labels: [
              {
                name: "suite",
                value: "foo",
              },
              { name: "subSuite", value: "bar" },
            ],
          },
          {
            name: "1 sample failed test",
            fullName: "sample.js#1 sample failed test",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: 5000,
            statusDetails: {
              message: "Assertion error: Expected 1 to be 2",
              trace: "failed test trace",
            },
          },
        ],
      },
      {
        groupBy: ["parentSuite", "suite", "subSuite"],
      },
    );

    await page.goto(bootstrap.url);

    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.sectionsLocator).toHaveCount(2);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("Assign me please!");
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("foo / bar");
    await treePage.toggleNthSection(1);

    await expect(treePage.leafLocator).toHaveCount(2);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");
    await expect(treePage.getNthLeafOrderLocator(0)).toHaveText("1");
    await expect(treePage.getNthLeafTitleLocator(1)).toHaveText("1 sample failed test");
    await expect(treePage.getNthLeafOrderLocator(1)).toHaveText("1");
  });

  test("should render mixed suite depth when some labels are missing", async ({ page }) => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
        },
        testResults: [
          {
            name: "0 with full depth",
            fullName: "sample.js#0 with full depth",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 1000,
            labels: [
              { name: "parentSuite", value: "frontend" },
              { name: "suite", value: "checkout" },
              { name: "subSuite", value: "happy path" },
            ],
          },
          {
            name: "1 without subSuite",
            fullName: "sample.js#1 without subSuite",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 2000,
            labels: [
              { name: "parentSuite", value: "frontend" },
              { name: "suite", value: "checkout" },
            ],
          },
          {
            name: "2 without parentSuite",
            fullName: "sample.js#2 without parentSuite",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 3000,
            labels: [{ name: "suite", value: "payments" }],
          },
        ],
      },
      {
        groupBy: ["parentSuite", "suite", "subSuite"],
      },
    );

    await page.goto(bootstrap.url);

    await expect(treePage.sectionsLocator).toHaveCount(2);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("frontend / checkout");
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("payments");

    await treePage.toggleNthSection(0);
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("happy path");
    await expect(treePage.getNthSectionTitleLocator(2)).toHaveText("payments");
    await expect(treePage.getLeafByTitle("1 without subSuite")).toHaveCount(1);

    await treePage.toggleNthSection(1);
    await treePage.toggleNthSection(2);

    await expect(treePage.leafLocator).toHaveCount(3);
    await expect(treePage.getLeafByTitle("0 with full depth")).toHaveCount(1);
    await expect(treePage.getLeafByTitle("1 without subSuite")).toHaveCount(1);
    await expect(treePage.getLeafByTitle("2 without parentSuite")).toHaveCount(1);
  });
});

test("reveals a compact group in the test's environment from its breadcrumb", async ({ page }) => {
  const report = await bootstrapReport({
    reportConfig: {
      name: "Compact groups across environments",
      appendHistory: false,
      environments: {
        linux: { matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "linux") },
        windows: { matcher: ({ labels }) => labels.some(({ name, value }) => name === "env" && value === "windows") },
      },
    },
    testResults: ["linux", "windows"].map((env) => ({
      name: `${env} test`,
      fullName: `${env} test`,
      status: Status.FAILED,
      stage: Stage.FINISHED,
      labels: [{ name: "env", value: env }],
      titlePath: ["Shared", `${env} suite`],
    })),
  });

  try {
    await page.goto(report.url);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("Shared / linux suite");
    await treePage.getLeafByTitle("windows test").click();
    await page.getByRole("button", { name: "Shared / windows suite", exact: true }).click();

    await expect(
      page.locator('[data-tree-node-id^="windows:"]').filter({ hasText: "Shared / windows suite" }),
    ).toHaveClass(/tree-section-focused/);
  } finally {
    await report.shutdown?.();
  }
});

test.describe("features", () => {
  test.beforeAll(async () => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
        },
        testResults: [
          {
            name: "0 sample passed test",
            fullName: "sample.js#0 sample passed test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 1000,
            labels: [{ name: "feature", value: "foo" }],
          },
          {
            name: "1 sample failed test",
            fullName: "sample.js#1 sample failed test",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: 5000,
            statusDetails: {
              message: "Assertion error: Expected 1 to be 2",
              trace: "failed test trace",
            },
          },
        ],
      },
      {
        groupBy: ["feature"],
      },
    );
  });

  test("features groups are displayed", async () => {
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("foo");
    await treePage.toggleNthSection(0);
    await expect(treePage.leafLocator).toHaveCount(2);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");
    await expect(treePage.getNthLeafOrderLocator(0)).toHaveText("1");
    await expect(treePage.getNthLeafTitleLocator(1)).toHaveText("1 sample failed test");
    await expect(treePage.getNthLeafOrderLocator(1)).toHaveText("1");
  });
});

test.describe("stories", () => {
  test.beforeAll(async () => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
        },
        testResults: [
          {
            name: "0 sample passed test",
            fullName: "sample.js#0 sample passed test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 1000,
            labels: [{ name: "story", value: "foo" }],
          },
          {
            name: "1 sample failed test",
            fullName: "sample.js#1 sample failed test",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: 5000,
            statusDetails: {
              message: "Assertion error: Expected 1 to be 2",
              trace: "failed test trace",
            },
          },
        ],
      },
      {
        groupBy: ["story"],
      },
    );
  });

  test("stories groups are displayed", async () => {
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("foo");
    await treePage.toggleNthSection(0);
    await expect(treePage.leafLocator).toHaveCount(2);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");
    await expect(treePage.getNthLeafOrderLocator(0)).toHaveText("1");
    await expect(treePage.getNthLeafTitleLocator(1)).toHaveText("1 sample failed test");
    await expect(treePage.getNthLeafOrderLocator(1)).toHaveText("1");
  });
});
