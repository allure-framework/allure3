import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeHistoryId, makeReportConfig, makeTestResultNames, makeTestResults } from "../utils/mocks.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;

const reportName = "Sample allure report";

const { name: firstTestWithRetries, fullName: firstTestWithRetriesFullname } =
  makeTestResultNames("first test with retries");
const firstTestWithRetriesHistoryId = makeHistoryId(firstTestWithRetriesFullname);

const { name: secondTestWithRetriesName, fullName: secondTestWithRetriesFullname } =
  makeTestResultNames("second test with retries");
const secondTestWithRetriesHistoryId = makeHistoryId(secondTestWithRetriesFullname);

const { name: testWithoutRetriesName, fullName: testWithoutRetriesFullname } =
  makeTestResultNames("test without retries");
const testWithoutRetriesHistoryId = makeHistoryId(testWithoutRetriesFullname);

test.describe("retries", () => {
  test.beforeAll(async () => {
    const testResults = makeTestResults(6, (index) => {
      if ([0, 1, 2].includes(index)) {
        return {
          name: firstTestWithRetries,
          fullName: firstTestWithRetriesFullname,
          historyId: firstTestWithRetriesHistoryId,
          status: index % 2 === 0 ? Status.FAILED : Status.PASSED,
          stage: Stage.FINISHED,
        };
      } else if ([3, 4].includes(index)) {
        return {
          name: secondTestWithRetriesName,
          fullName: secondTestWithRetriesFullname,
          historyId: secondTestWithRetriesHistoryId,
          status: Status.PASSED,
          stage: Stage.FINISHED,
        };
      }

      return {
        name: testWithoutRetriesName,
        fullName: testWithoutRetriesFullname,
        historyId: testWithoutRetriesHistoryId,
        status: Status.PASSED,
        stage: Stage.FINISHED,
      };
    });

    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: reportName,
        appendHistory: false,
      }),
      testResults,
    });
  });

  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);

    treePage = new TreePage(page);

    await page.goto(bootstrap.url);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("shows only tests with retries", async () => {
    await expect(treePage.leafLocator).toHaveCount(3);
    await treePage.toggleRetryFilter();
    await expect(treePage.leafLocator).toHaveCount(2);
    await treePage.toggleRetryFilter();
    await expect(treePage.leafLocator).toHaveCount(3);
  });

  test("should show retry icon in the tree for tests with retries", async ({ page }) => {
    const retryIcons = page.getByTestId("tree-leaf-retries");

    await expect(retryIcons).toHaveCount(2);

    const firstTestWithRetriesIcon = treePage.getLeafByTitle(firstTestWithRetries).getByTestId("tree-leaf-retries");
    const anotherTestWithRetriesIcon = treePage
      .getLeafByTitle(secondTestWithRetriesName)
      .getByTestId("tree-leaf-retries");

    await expect(firstTestWithRetriesIcon).toContainText("2");
    await expect(anotherTestWithRetriesIcon).toContainText("1");
  });

  test("metadata shows correct count of retries", async () => {
    const total = await treePage.getMetadataValue("total");
    const retries = await treePage.getMetadataValue("retries");

    expect(total).toBe("3");
    expect(retries).toBe("2");
  });

  test("should show tooltip with retries filter description on hover", async () => {
    await treePage.openFilterMenu();
    await expect(treePage.retryFilterLocator).toBeVisible();
    await treePage.retryFilterLocator.hover();
    await expect(treePage.filterTooltipLocator).toBeVisible();
    await treePage.closeTooltip();
    await expect(treePage.filterTooltipLocator).toBeHidden();
  });
});
