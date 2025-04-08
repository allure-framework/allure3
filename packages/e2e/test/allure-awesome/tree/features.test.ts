import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;

test.describe("stories", () => {
  test.beforeAll(async () => {
    bootstrap = await bootstrapReport(
      {
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

  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);
    await page.goto(bootstrap.url);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("features groups are displayed", async ({ page }) => {
    const treeLeaves = page.getByTestId("tree-leaf");
    const parentGroupHeader = page.getByTestId("tree-section");

    await expect(treeLeaves).toHaveCount(1);
    await expect(parentGroupHeader.getByTestId("tree-section-title")).toHaveText("foo");
    await parentGroupHeader.getByTestId("tree-arrow").click();

    await expect(treeLeaves).toHaveCount(2);
    await expect(treeLeaves.nth(0).getByTestId("tree-leaf-title")).toHaveText("0 sample passed test");
    await expect(treeLeaves.nth(0).getByTestId("tree-leaf-order")).toHaveText("1");
    await expect(treeLeaves.nth(1).getByTestId("tree-leaf-title")).toHaveText("1 sample failed test");
    await expect(treeLeaves.nth(1).getByTestId("tree-leaf-order")).toHaveText("1");
  });
});
