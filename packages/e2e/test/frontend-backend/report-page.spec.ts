import { expect, test } from "@playwright/test";
import { getEnv, createLaunchWithResults } from "./fixtures.js";
import { TreePage, TestResultPage } from "../pageObjects/index.js";

test.describe("Report page", () => {
  test("opens report and shows tree and test result", async ({ page }) => {
    const env = getEnv();
    const { launchId, FRONTEND_URL, API_BASE_URL } = await createLaunchWithResults(env);

    const reportUrl =
      `${FRONTEND_URL}/report?launch_id=${encodeURIComponent(launchId)}` +
      `&apiBaseUrl=${encodeURIComponent(API_BASE_URL)}`;
    await page.goto(reportUrl);

    const treePage = new TreePage(page);
    const testResultPage = new TestResultPage(page);

    await expect(treePage.leafLocator).toHaveCount(2, { timeout: 15000 });
    await expect(treePage.getNthLeafTitleLocator(0)).toHaveText("Test A");
    await expect(treePage.getNthLeafTitleLocator(1)).toHaveText("Test B");

    await treePage.clickNthLeaf(0);
    await expect(testResultPage.titleLocator).toHaveText("Test A", { timeout: 5000 });
    await expect(testResultPage.statusPassedLocator).toBeVisible();

    await testResultPage.clickNextTestResult();
    await expect(testResultPage.titleLocator).toHaveText("Test B", { timeout: 5000 });
    await expect(testResultPage.statusFailedLocator).toBeVisible();
  });
});
