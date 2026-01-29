import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeReportConfig, makeTestResult, makeTestResultNames } from "../utils/mocks.js";

const reportName = "Sample allure report";
const testTag = "e2e-test-tag";
const otherTag = "other-tag";

const { name: testWithTagName, fullName: testWithTagFullname } = makeTestResultNames("test with tag");
const { name: testWithoutTagName, fullName: testWithoutTagFullname } = makeTestResultNames("test without tag");

test.describe("tags", () => {
  let bootstrap: ReportBootstrap;

  test.beforeAll(async () => {
    const testResults = [
      makeTestResult({
        name: testWithTagName,
        fullName: testWithTagFullname,
        status: Status.PASSED,
        stage: Stage.FINISHED,
        labels: [{ name: "tag", value: testTag }],
      }),
      makeTestResult({
        name: testWithoutTagName,
        fullName: testWithoutTagFullname,
        status: Status.PASSED,
        stage: Stage.FINISHED,
        labels: [{ name: "tag", value: otherTag }],
      }),
    ];

    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: reportName,
      }),
      testResults,
    });
  });

  test.beforeEach(async ({ browserName }) => {
    await label("env", browserName);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("should filter tree by tag when clicking Go to filter from tag metadata", async ({ page, context }) => {
    await page.goto(bootstrap.url);
    const treePage = new TreePage(page);

    // Verify all tests are visible initially
    await expect(treePage.leafLocator).toHaveCount(2);
    await expect(treePage.getLeafByTitle(testWithTagName)).toBeVisible();
    await expect(treePage.getLeafByTitle(testWithoutTagName)).toBeVisible();

    // Click on test with tag to open test result page
    await treePage.getLeafByTitle(testWithTagName).click();

    const testResultPage = new TestResultPage(page);

    // Wait for test result page to load
    await expect(testResultPage.titleLocator).toHaveText(testWithTagName);

    // Find tag in metadata - look for metadata item with key "tag"
    const tagMetadataKey = page.getByTestId("metadata-item-key").filter({ hasText: "tag" });
    await expect(tagMetadataKey).toBeVisible();

    await page.getByText(testTag).click();

    // Click on "Go to filter" - it opens in new tab
    const [newPage] = await Promise.all([context.waitForEvent("page"), page.getByText("Go to filter").click()]);

    // Verify URL contains tag filter
    const url = newPage.url();
    expect(url).toContain(`tags=${encodeURIComponent(testTag)}`);

    // Create new TreePage for the new page
    const newTreePage = new TreePage(newPage);

    // Verify tree is filtered - only test with tag should be visible
    await expect(newTreePage.leafLocator).toHaveCount(1);
    await expect(newTreePage.getLeafByTitle(testWithTagName)).toBeVisible();
    await expect(newTreePage.getLeafByTitle(testWithoutTagName)).not.toBeVisible();
  });
});
