import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeReportConfig, makeTestResult, makeTestResultNames } from "../utils/mocks.js";

const reportName = "Sample allure report";
const ownerRfc2822Email = "John Doe <john.doe@example.com>";
const ownerRfc2822Url = "Jane Smith <https://github.com/janesmith>";
const ownerPlainText = "QA Team";
const ownerPlainEmail = "dev@example.com";

const { name: testWithOwnerName, fullName: testWithOwnerFullname } = makeTestResultNames("test with owner label");

test.describe("owner label (RFC 2822)", () => {
  let bootstrap: ReportBootstrap;

  test.beforeAll(async () => {
    const testResults = [
      makeTestResult({
        name: testWithOwnerName,
        fullName: testWithOwnerFullname,
        status: Status.PASSED,
        stage: Stage.FINISHED,
        labels: [
          { name: "owner", value: ownerRfc2822Email },
          { name: "owner", value: ownerRfc2822Url },
          { name: "owner", value: ownerPlainText },
          { name: "owner", value: ownerPlainEmail },
        ],
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

  test("should display owner label in metadata with RFC 2822 display names and plain text", async ({ page }) => {
    await page.goto(bootstrap.url);
    const treePage = new TreePage(page);

    await expect(treePage.getLeafByTitle(testWithOwnerName)).toBeVisible();
    await treePage.getLeafByTitle(testWithOwnerName).click();

    const testResultPage = new TestResultPage(page);
    await expect(testResultPage.titleLocator).toHaveText(testWithOwnerName);

    const ownerMetadataKey = page.getByTestId("metadata-item-key").filter({ hasText: "owner" });
    await expect(ownerMetadataKey).toBeVisible();

    await expect(page.getByText("John Doe")).toBeVisible();
    await expect(page.getByText("Jane Smith")).toBeVisible();
    await expect(page.getByText("QA Team")).toBeVisible();
    await expect(page.getByText(ownerPlainEmail)).toBeVisible();
  });

  test("should show Copy email and Copy buttons in owner popup for RFC 2822 email", async ({ page }) => {
    await page.goto(bootstrap.url);
    const treePage = new TreePage(page);
    const testResultPage = new TestResultPage(page);
    await treePage.getLeafByTitle(testWithOwnerName).click();

    await expect(testResultPage.titleLocator).toHaveText(testWithOwnerName);

    await page.getByText("John Doe").click();

    await expect(page.getByRole("button", { name: "Copy email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
  });

  test("should show URL link and Copy button in owner popup for RFC 2822 URL", async ({ page }) => {
    await page.goto(bootstrap.url);
    const treePage = new TreePage(page);
    const testResultPage = new TestResultPage(page);
    await treePage.getLeafByTitle(testWithOwnerName).click();

    await expect(testResultPage.titleLocator).toHaveText(testWithOwnerName);

    await page.getByText("Jane Smith").click();

    await expect(page.getByRole("link", { name: /github\.com/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
  });

  test("should show only Copy button in owner popup for plain text owner", async ({ page }) => {
    await page.goto(bootstrap.url);
    const treePage = new TreePage(page);
    const testResultPage = new TestResultPage(page);
    await treePage.getLeafByTitle(testWithOwnerName).click();

    await expect(testResultPage.titleLocator).toHaveText(testWithOwnerName);

    await page.getByText("QA Team").click();

    await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy email" })).not.toBeVisible();
  });

  test("should show only Copy button in owner popup when owner is plain email address", async ({ page }) => {
    await page.goto(bootstrap.url);
    const treePage = new TreePage(page);
    const testResultPage = new TestResultPage(page);
    await treePage.getLeafByTitle(testWithOwnerName).click();

    await expect(testResultPage.titleLocator).toHaveText(testWithOwnerName);

    await page.getByText(ownerPlainEmail).click();

    await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy email" })).not.toBeVisible();
  });
});
