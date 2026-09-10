import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { epic, feature, label, Stage, Status, story } from "allure-js-commons";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeReportConfig, makeTestResultNames } from "../utils/mocks.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

const reportName = "Sample allure report";

const { name: knownTestName, fullName: knownTestFullName } = makeTestResultNames("known failed");
const { name: mutedTestName, fullName: mutedTestFullName } = makeTestResultNames("muted failed");
const { name: plainFailedTestName, fullName: plainFailedTestFullName } = makeTestResultNames("plain failed");
const { name: knownBrokenTestName, fullName: knownBrokenTestFullName } = makeTestResultNames("known broken");
const { name: mutedKnownTestName, fullName: mutedKnownTestFullName } = makeTestResultNames("muted and known failed");

const now = Date.now();

const makeRawResult = (
  name: string,
  fullName: string,
  status: typeof Status.FAILED | typeof Status.BROKEN,
  statusDetails: { known?: boolean; muted?: boolean },
) => ({
  uuid: randomUUID(),
  name,
  fullName,
  status,
  stage: Stage.FINISHED,
  start: now,
  stop: now + 1000,
  statusDetails,
  labels: [{ name: "suite", value: "resolutions" }],
});

const makeRawFailedResult = (name: string, fullName: string, statusDetails: { known?: boolean; muted?: boolean }) =>
  makeRawResult(name, fullName, Status.FAILED, statusDetails);

test.describe("resolutions from result", () => {
  test.beforeAll(async () => {
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: reportName,
      }),
      rawTestResults: [
        makeRawFailedResult(knownTestName, knownTestFullName, { known: true }),
        makeRawFailedResult(mutedTestName, mutedTestFullName, { muted: true }),
        makeRawFailedResult(plainFailedTestName, plainFailedTestFullName, {}),
        makeRawResult(knownBrokenTestName, knownBrokenTestFullName, Status.BROKEN, { known: true }),
        makeRawFailedResult(mutedKnownTestName, mutedKnownTestFullName, { muted: true, known: true }),
      ],
    });
  });

  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);
    await epic("coverage");
    await feature("resolutions");
    await story("resolutions-from-result");
    await label("coverage", "resolutions");
    treePage = new TreePage(page);
    testResultPage = new TestResultPage(page);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("should show accepted resolution icon for known failed leaf", async ({ page }) => {
    await page.goto(bootstrap.url);

    await expect(treePage.getLeafResolutionAcceptedLocator(knownTestName)).toBeVisible();
  });

  test("should show muted resolution icon for muted failed leaf", async ({ page }) => {
    await page.goto(bootstrap.url);

    await expect(treePage.getLeafResolutionMutedLocator(mutedTestName)).toBeVisible();
  });

  test("should not show resolution icons for plain failed leaf", async ({ page }) => {
    await page.goto(bootstrap.url);

    await expect(treePage.getLeafResolutionAcceptedLocator(plainFailedTestName)).not.toBeVisible();
    await expect(treePage.getLeafResolutionMutedLocator(plainFailedTestName)).not.toBeVisible();
    await expect(treePage.getLeafResolutionIssueLocator(plainFailedTestName)).not.toBeVisible();
  });

  test("should show resolution categories tab for muted and known results", async ({ page }) => {
    await page.goto(bootstrap.url);

    await treePage.openTestResultByTitle(mutedTestName);
    await expect(testResultPage.tabById("resolutionCategories")).toBeVisible();
    await testResultPage.tabById("resolutionCategories").click();
    await expect(page.getByText("Muted from result")).toBeVisible();

    await page.goto(bootstrap.url);
    await treePage.openTestResultByTitle(knownTestName);
    await expect(testResultPage.tabById("resolutionCategories")).toBeVisible();
    await testResultPage.tabById("resolutionCategories").click();
    await expect(page.getByText("Accepted from result (known)")).toBeVisible();

    await page.goto(bootstrap.url);
    await treePage.openTestResultByTitle(plainFailedTestName);
    await expect(testResultPage.tabById("resolutionCategories")).not.toBeVisible();
  });

  test("should filter tree by accepted resolution", async ({ page }) => {
    await page.goto(bootstrap.url);

    await treePage.toggleAcceptedResolutionFilter();
    await expect(treePage.getLeafByTitle(knownTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(knownBrokenTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(plainFailedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(mutedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(mutedKnownTestName)).not.toBeVisible();
  });

  test("should filter tree by muted resolution", async ({ page }) => {
    await page.goto(bootstrap.url);

    await treePage.toggleMutedResolutionFilter();
    await expect(treePage.getLeafByTitle(mutedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(mutedKnownTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(knownTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(knownBrokenTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(plainFailedTestName)).not.toBeVisible();
  });

  test("should show accepted resolution icon for known broken leaf", async ({ page }) => {
    await page.goto(bootstrap.url);

    await expect(treePage.getLeafResolutionAcceptedLocator(knownBrokenTestName)).toBeVisible();
  });

  test("should prefer muted when both muted and known are set", async ({ page }) => {
    await page.goto(bootstrap.url);

    await expect(treePage.getLeafResolutionMutedLocator(mutedKnownTestName)).toBeVisible();

    await treePage.openTestResultByTitle(mutedKnownTestName);
    await expect(testResultPage.tabById("resolutionCategories")).toBeVisible();
    await testResultPage.tabById("resolutionCategories").click();
    await expect(page.getByText("Muted from result")).toBeVisible();
  });
});
