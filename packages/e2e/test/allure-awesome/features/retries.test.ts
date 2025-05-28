import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;

test.beforeEach(async ({ browserName, page }) => {
  await label("env", browserName);

  treePage = new TreePage(page);

  if (bootstrap) {
    await page.goto(bootstrap.url);
  }
});

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test.describe("retries", () => {
  test.beforeAll(async () => {
    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
      },
      testResults: [
        {
          name: "0 sample test",
          fullName: "sample.js#0 sample test",
          historyId: "foo",
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: 0,
          statusDetails: {
            message: "Assertion error: Expected 1 to be 2",
            trace: "failed test trace",
          },
        },
        {
          name: "0 sample test",
          fullName: "sample.js#0 sample test",
          historyId: "foo",
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: 1000,
          statusDetails: {
            message: "Assertion error: Expected 1 to be 2",
            trace: "failed test trace",
          },
        },
        {
          name: "0 sample test",
          fullName: "sample.js#0 sample test",
          historyId: "foo",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 2000,
        },
        {
          name: "1 sample test",
          fullName: "sample.js#1 sample test",
          historyId: "bar",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 3000,
        },
        {
          name: "1 sample test",
          fullName: "sample.js#1 sample test",
          historyId: "bar",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 4000,
        },
        {
          name: "2 sample test",
          fullName: "sample.js#2 sample test",
          historyId: "baz",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 5000,
        },
      ],
    });
  });

  test("shows only tests with retries", async () => {
    await expect(treePage.leafLocator).toHaveCount(3);
    await treePage.toggleRetryFilter();
    await expect(treePage.leafLocator).toHaveCount(2);
    await treePage.toggleRetryFilter();
    await expect(treePage.leafLocator).toHaveCount(3);
  });

  test("should show retry icon in the tree for tests with retries", async ({ page }) => {
    const retryIcons = page.getByTestId("tree-item-retries");

    await expect(retryIcons).toHaveCount(2);

    const testWithRetriesIcon = treePage.getLeafByTitle("0 sample test").getByTestId("tree-item-retries");
    const anotherTestWithRetriesIcon = treePage.getLeafByTitle("1 sample test").getByTestId("tree-item-retries");

    await expect(testWithRetriesIcon).toContainText("2");
    await expect(anotherTestWithRetriesIcon).toContainText("1");
  });

  test("metadata shows correct count of retries", async () => {
    const { total, retries } = await treePage.getMetadataValues();

    expect(total).toBe("3");
    expect(retries).toBe("2");
  });
});
