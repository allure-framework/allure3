import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

test.beforeEach(async ({ browserName, page }) => {
  await label("env", browserName);

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
          knownIssuesPath: undefined,
        },
        testResults: [
          {
            name: "0 sample passed test",
            fullName: "sample.js#0 sample passed test",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: 1000,
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
    await treePage.searchTree("0 sample");
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("0 sample passed test");
  });
});

test.describe("SearchBox component with debounce", () => {
  test("should update value with debounce and clear input", async ({ page }) => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          knownIssuesPath: "",
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
  test("should display tree groups with a correct suites hierarchy", async ({ page }) => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          knownIssuesPath: undefined,
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
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("foo");
    await treePage.toggleNthSection(0);

    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("foo");
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("bar");
    await treePage.toggleNthSection(1);

    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("foo");
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("bar");
    await expect(treePage.getNthSectionTitleLocator(2)).toHaveText("baz");
    await treePage.toggleNthSection(2);

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
          knownIssuesPath: undefined,
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
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("foo");
    await treePage.toggleNthSection(0);

    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.sectionsLocator).toHaveCount(2);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("foo");
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("bar");
    await treePage.toggleNthSection(1);

    await expect(treePage.sectionsLocator).toHaveCount(2);
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
          knownIssuesPath: undefined,
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
    // all nodes locates in the group, so tree can't be collapsed and we see two groups intially
    await expect(treePage.sectionsLocator).toHaveCount(2);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("Assign me please!");
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("foo");
    await treePage.toggleNthSection(1);

    await expect(treePage.sectionsLocator).toHaveCount(3);
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("Assign me please!");
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("foo");
    await expect(treePage.getNthSectionTitleLocator(2)).toHaveText("bar");
    await treePage.toggleNthSection(2);

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
          knownIssuesPath: undefined,
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
    await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("frontend");
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("payments");

    await treePage.toggleNthSection(0);
    await expect(treePage.getNthSectionTitleLocator(1)).toHaveText("checkout");
    await expect(treePage.getNthSectionTitleLocator(2)).toHaveText("payments");

    await treePage.toggleNthSection(1);
    await expect(treePage.getNthSectionTitleLocator(2)).toHaveText("happy path");
    await expect(treePage.getNthSectionTitleLocator(3)).toHaveText("payments");

    await treePage.toggleNthSection(2);
    await treePage.toggleNthSection(3);

    await expect(treePage.leafLocator).toHaveCount(3);
    await expect(treePage.getLeafByTitle("0 with full depth")).toHaveCount(1);
    await expect(treePage.getLeafByTitle("1 without subSuite")).toHaveCount(1);
    await expect(treePage.getLeafByTitle("2 without parentSuite")).toHaveCount(1);
  });
});

test.describe("features", () => {
  test.beforeAll(async () => {
    bootstrap = await bootstrapReport(
      {
        reportConfig: {
          name: "Sample allure report",
          appendHistory: false,
          knownIssuesPath: undefined,
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
          knownIssuesPath: undefined,
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
