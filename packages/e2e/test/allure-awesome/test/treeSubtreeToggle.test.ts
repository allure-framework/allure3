import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";

import { TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;

test.beforeEach(async ({ browserName, page }) => {
  await label("env", browserName);

  treePage = new TreePage(page);
  bootstrap = await bootstrapReport(
    {
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
      },
      testResults: [
        {
          name: "case 1",
          fullName: "sample.js#case 1",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 1000,
          labels: [
            { name: "parentSuite", value: "parent" },
            { name: "suite", value: "suite-a" },
            { name: "subSuite", value: "sub-a" },
          ],
        },
        {
          name: "case 2",
          fullName: "sample.js#case 2",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 2000,
          labels: [
            { name: "parentSuite", value: "parent" },
            { name: "suite", value: "suite-a" },
            { name: "subSuite", value: "sub-b" },
          ],
        },
        {
          name: "case 3",
          fullName: "sample.js#case 3",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: 3000,
          labels: [
            { name: "parentSuite", value: "parent" },
            { name: "suite", value: "suite-b" },
            { name: "subSuite", value: "sub-c" },
          ],
        },
      ],
    },
    {
      groupBy: ["parentSuite", "suite", "subSuite"],
    },
  );

  await page.goto(bootstrap.url);
});

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test("should cycle subtree toggle state like categories", async () => {
  await expect(treePage.leafLocator).toHaveCount(0);
  for (let i = 0; i < 3; i += 1) {
    const openedCount = await treePage.getNthSectionContentLocator(0).count();
    if (openedCount === 0) {
      break;
    }
    await treePage.clickNthSectionSubtreeToggle(0);
  }
  await expect(treePage.getNthSectionContentLocator(0)).toHaveCount(0);
  await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("parent");

  await treePage.clickNthSectionSubtreeToggle(0);
  await expect(treePage.getNthSectionContentLocator(0)).toHaveCount(1);
  await expect(treePage.leafLocator).toHaveCount(0);

  await treePage.clickNthSectionSubtreeToggle(0);
  await expect(treePage.leafLocator).toHaveCount(3);

  await treePage.clickNthSectionSubtreeToggle(0);
  await expect(treePage.getNthSectionContentLocator(0)).toHaveCount(1);
  await expect(treePage.leafLocator).toHaveCount(0);

  await treePage.clickNthSectionSubtreeToggle(0);
  await expect(treePage.getNthSectionContentLocator(0)).toHaveCount(0);
  await expect(treePage.getNthSectionTitleLocator(0)).toHaveText("parent");
  await expect(treePage.leafLocator).toHaveCount(0);
});
