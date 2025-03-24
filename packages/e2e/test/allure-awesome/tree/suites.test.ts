import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { type ReportBootstrap, boostrapReport } from "../../utils/index.js";

let bootstrap: ReportBootstrap;

test.describe("suites", () => {
  test.afterEach(async () => {
    await bootstrap?.shutdown?.();
  });

  test.beforeEach(async ({ browserName }) => {
    await label("env", browserName);
  });

  test("should display tree groups with a correct suites hierarchy", async ({ page }) => {
    bootstrap = await boostrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        history: undefined,
        historyPath: undefined,
        knownIssuesPath: undefined,
      },
      pluginConfig: {
        groupBy: ["parentSuite", "suite", "subSuite"],
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
    });

    await page.goto(bootstrap.url);

    const treeLeaves = page.getByTestId("tree-leaf");
    const parentGroupHeader = page.getByTestId("tree-section");

    await expect(treeLeaves).toHaveCount(1);
    await expect(parentGroupHeader.getByTestId("tree-section-title")).toHaveText("foo");
    await parentGroupHeader.getByTestId("tree-arrow").click();

    await expect(parentGroupHeader).toHaveCount(2);
    await expect(parentGroupHeader.nth(0).getByTestId("tree-section-title")).toHaveText("foo");
    await expect(parentGroupHeader.nth(1).getByTestId("tree-section-title")).toHaveText("bar");
    await parentGroupHeader.nth(1).getByTestId("tree-arrow").click();

    await expect(parentGroupHeader).toHaveCount(3);
    await expect(parentGroupHeader.nth(0).getByTestId("tree-section-title")).toHaveText("foo");
    await expect(parentGroupHeader.nth(1).getByTestId("tree-section-title")).toHaveText("bar");
    await expect(parentGroupHeader.nth(2).getByTestId("tree-section-title")).toHaveText("baz");
    await parentGroupHeader.nth(2).getByTestId("tree-arrow").click();

    await expect(treeLeaves).toHaveCount(2);
    await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("0 sample passed test");
    await expect(treeLeaves.nth(0).getByTestId("tree-leaf-order")).toHaveText("1");
    await expect(treeLeaves.nth(1).getByTestId("tree-leaf-title")).toHaveText("1 sample failed test");
    await expect(treeLeaves.nth(1).getByTestId("tree-leaf-order")).toHaveText("1");
  });

  test("should not display groups when test results don't have related label", async ({ page }) => {
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
    });

    await page.goto(bootstrap.url);

    const treeLeaves = page.getByTestId("tree-leaf");
    const parentGroupHeader = page.getByTestId("tree-section");

    await expect(treeLeaves).toHaveCount(1);
    await expect(parentGroupHeader.getByTestId("tree-section-title")).toHaveText("foo");
    await parentGroupHeader.getByTestId("tree-arrow").click();

    await expect(parentGroupHeader).toHaveCount(2);
    await expect(parentGroupHeader.nth(0).getByTestId("tree-section-title")).toHaveText("foo");
    await expect(parentGroupHeader.nth(1).getByTestId("tree-section-title")).toHaveText("bar");
    await parentGroupHeader.nth(1).getByTestId("tree-arrow").click();

    await expect(treeLeaves).toHaveCount(2);
    await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("0 sample passed test");
    await expect(treeLeaves.nth(1).getByTestId("tree-leaf-title")).toHaveText("1 sample failed test");
  });

  test("should assign default labels when test results don't any matched one label", async ({ page }) => {
    bootstrap = await boostrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        history: undefined,
        historyPath: undefined,
        knownIssuesPath: undefined,
        defaultLabels: {
          parentSuite: "Assign me please!",
        },
      },
      pluginConfig: {
        groupBy: ["parentSuite", "suite", "subSuite"],
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
    });

    await page.goto(bootstrap.url);

    const treeLeaves = page.getByTestId("tree-leaf");
    const parentGroupHeader = page.getByTestId("tree-section");

    await expect(treeLeaves).toHaveCount(1);
    // all nodes locates in the group, so tree can't be collapsed and we see two groups intially
    await expect(parentGroupHeader).toHaveCount(2);
    await expect(parentGroupHeader.nth(0).getByTestId("tree-section-title")).toHaveText("Assign me please!");
    await expect(parentGroupHeader.nth(1).getByTestId("tree-section-title")).toHaveText("foo");
    await parentGroupHeader.nth(1).getByTestId("tree-arrow").click();

    await expect(parentGroupHeader).toHaveCount(3);
    await expect(parentGroupHeader.nth(0).getByTestId("tree-section-title")).toHaveText("Assign me please!");
    await expect(parentGroupHeader.nth(1).getByTestId("tree-section-title")).toHaveText("foo");
    await expect(parentGroupHeader.nth(2).getByTestId("tree-section-title")).toHaveText("bar");
    await parentGroupHeader.nth(2).getByTestId("tree-arrow").click();

    await expect(treeLeaves).toHaveCount(2);
    await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("0 sample passed test");
    await expect(treeLeaves.nth(0).getByTestId("tree-leaf-order")).toHaveText("1");
    await expect(treeLeaves.nth(1).getByTestId("tree-leaf-title")).toHaveText("1 sample failed test");
    await expect(treeLeaves.nth(1).getByTestId("tree-leaf-order")).toHaveText("1");
  });
});
