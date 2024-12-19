import { expect, test } from "@playwright/test";
import { layer } from "allure-js-commons";
import { Stage, Status } from "allure-js-commons";
import { type ReportBootstrap, boostrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;

test.beforeAll(async () => {
  bootstrap = await boostrapReport({
    reportConfig: {
      name: "Sample allure report",
      appendHistory: false,
      history: undefined,
      historyPath: undefined,
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
  });
});

test.afterAll(async () => {
  await bootstrap.shutdown();
});

test.beforeEach(async ({ page }) => {
  await layer("e2e");
  await page.goto(bootstrap.url);
});

test.describe("allure-awesome", () => {
  test.describe("tree", () => {
    test("all types of tests are displayed", async ({ page }) => {
      const treeLeaves = page.getByTestId("tree-leaf");

      await expect(treeLeaves).toHaveCount(5);
      await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("0 sample passed test");
      await expect(treeLeaves.nth(0).getByTestId("tree-leaf-status-passed")).toBeVisible();
      await expect(treeLeaves.nth(0).getByTestId("tree-leaf-order")).toHaveText("#1");
      await expect(treeLeaves.nth(1).getByTestId("tree-leaf-title")).toHaveText("1 sample failed test");
      await expect(treeLeaves.nth(1).getByTestId("tree-leaf-status-failed")).toBeVisible();
      await expect(treeLeaves.nth(1).getByTestId("tree-leaf-order")).toHaveText("#2");
      await expect(treeLeaves.nth(2).getByTestId("tree-leaf-title")).toHaveText("2 sample broken test");
      await expect(treeLeaves.nth(2).getByTestId("tree-leaf-status-broken")).toBeVisible();
      await expect(treeLeaves.nth(2).getByTestId("tree-leaf-order")).toHaveText("#3");
      await expect(treeLeaves.nth(3).getByTestId("tree-leaf-title")).toHaveText("3 sample skipped test");
      await expect(treeLeaves.nth(3).getByTestId("tree-leaf-status-skipped")).toBeVisible();
      await expect(treeLeaves.nth(3).getByTestId("tree-leaf-order")).toHaveText("#4");
      await expect(treeLeaves.nth(4).getByTestId("tree-leaf-title")).toHaveText("4 sample unknown test");
      await expect(treeLeaves.nth(4).getByTestId("tree-leaf-status-unknown")).toBeVisible();
      await expect(treeLeaves.nth(4).getByTestId("tree-leaf-order")).toHaveText("#5");
    });

    test("statistics in metadata renders information about the tests", async ({ page }) => {
      await expect(page.getByTestId("metadata-item-total").getByTestId("metadata-value")).toHaveText("5");
      await expect(page.getByTestId("metadata-item-passed").getByTestId("metadata-value")).toHaveText("1");
      await expect(page.getByTestId("metadata-item-failed").getByTestId("metadata-value")).toHaveText("1");
      await expect(page.getByTestId("metadata-item-broken").getByTestId("metadata-value")).toHaveText("1");
      await expect(page.getByTestId("metadata-item-skipped").getByTestId("metadata-value")).toHaveText("1");
      await expect(page.getByTestId("metadata-item-unknown").getByTestId("metadata-value")).toHaveText("1");
    });

    test("tree tabs filter tests by the status", async ({ page }) => {
      const treeLeaves = page.getByTestId("tree-leaf");

      await expect(treeLeaves).toHaveCount(5);

      await page.getByTestId("tab-passed").click();
      await expect(treeLeaves).toHaveCount(1);
      await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("0 sample passed test");

      await page.getByTestId("tab-failed").click();
      await expect(treeLeaves).toHaveCount(1);
      await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("1 sample failed test");

      await page.getByTestId("tab-broken").click();
      await expect(treeLeaves).toHaveCount(1);
      await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("2 sample broken test");

      await page.getByTestId("tab-skipped").click();
      await expect(treeLeaves).toHaveCount(1);
      await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("3 sample skipped test");

      await page.getByTestId("tab-unknown").click();
      await expect(treeLeaves).toHaveCount(1);
      await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("4 sample unknown test");

      await page.getByTestId("tab-all").click();
      await expect(treeLeaves).toHaveCount(5);
    });

    test("test result page opens after test result click", async ({ page }) => {
      const passedLeaf = page.getByTestId("tree-leaf").nth(0);

      await passedLeaf.click();

      await expect(page.getByTestId("test-result-info-title")).toHaveText("0 sample passed test");
      await expect(page.getByTestId("tree-leaf-status-passed")).toBeVisible();
      await expect(page.getByTestId("test-result-fullname")).toHaveText("sample.js#0 sample passed test");
    });

    test("search filters tests on typing", async ({ page }) => {
      await expect(page.getByTestId("tree-leaf")).toHaveCount(5);
      await page.getByTestId("search-input").fill("0 sample");
      await expect(page.getByTestId("tree-leaf")).toHaveCount(1);
    });
  });
});
