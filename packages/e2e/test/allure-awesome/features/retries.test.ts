import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeHistoryId, makeReportConfig, makeTestResultNames, makeTestResults } from "../utils/mocks.js";

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
  test.describe("tree", () => {
    let bootstrap: ReportBootstrap;
    let treePage: TreePage;
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
  });

  test.describe("test results", () => {
    let bootstrap: ReportBootstrap;
    let treePage: TreePage;
    let testResultPage: TestResultPage;
    test.beforeAll(async () => {
      const now = Date.now();

      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: reportName,
          appendHistory: false,
        }),
        rawTestResults: [
          {
            name: "With timestamps",
            fullName: "With timestamps",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: now,
            stop: now + 1000,
          },
          {
            name: "With timestamps",
            fullName: "With timestamps",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: now + 1010,
            stop: now + 2000,
          },
          {
            name: "With timestamps",
            fullName: "With timestamps",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: now + 2010,
            stop: now + 3000,
          },
          {
            name: "Without timestamps",
            fullName: "Without timestamps",
            status: Status.PASSED,
            stage: Stage.FINISHED,
          },
          {
            name: "Without timestamps",
            fullName: "Without timestamps",
            status: Status.PASSED,
            stage: Stage.FINISHED,
          },
          {
            name: "Without timestamps",
            fullName: "Without timestamps",
            status: Status.PASSED,
            stage: Stage.FINISHED,
          },
        ],
      });
    });

    test.beforeEach(async ({ page, browserName }) => {
      await label("env", browserName);

      treePage = new TreePage(page);
      testResultPage = new TestResultPage(page);

      await page.goto(bootstrap.url);
    });

    test.afterAll(async () => {
      await bootstrap.shutdown();
    });

    test.describe("titles", () => {
      test("retry titles of tests with timestampts have prefixes and timestamps", async () => {
        await treePage.clickLeafByTitle("With timestamps");
        await testResultPage.tabById("retries").click();

        const retryAt0 = testResultPage.getRetry(0);
        const retryAt1 = testResultPage.getRetry(1);

        await expect(retryAt0.textLocator).toHaveText(/^Attempt 2 of 3 – \d+\/\d+\/\d+ at \d+:\d+:\d+$/);
        await expect(retryAt1.textLocator).toHaveText(/^Attempt 1 of 3 – \d+\/\d+\/\d+ at \d+:\d+:\d+$/);
      });

      test("retry titles of tests with no timestampts have prefixes", async () => {
        await treePage.clickLeafByTitle("Without timestamps");
        await testResultPage.tabById("retries").click();

        const retryAt0 = testResultPage.getRetry(0);
        const retryAt1 = testResultPage.getRetry(1);

        await expect(retryAt0.textLocator).toHaveText("Attempt 2 of 3");
        await expect(retryAt1.textLocator).toHaveText("Attempt 1 of 3");
      });
    });
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
