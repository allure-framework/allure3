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
const { name: activeMutedTestName, fullName: activeMutedTestFullName } = makeTestResultNames("active muted failed");
const { name: outdatedMutedTestName, fullName: outdatedMutedTestFullName } =
  makeTestResultNames("outdated muted failed");

const now = Date.now();
type RawStatusDetails = { known?: boolean; muted?: boolean; message?: string };

const makeRawResult = (
  name: string,
  fullName: string,
  status: typeof Status.FAILED | typeof Status.BROKEN,
  statusDetails: RawStatusDetails,
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

const makeRawFailedResult = (name: string, fullName: string, statusDetails: RawStatusDetails) =>
  makeRawResult(name, fullName, Status.FAILED, statusDetails);

test.describe("resolutions from result", () => {
  test.beforeAll(async () => {
    bootstrap = await bootstrapReport({
      reportConfig: makeReportConfig({
        name: reportName,
        resolutions: {
          rules: [
            {
              resolution: "muted",
              messageRegexp: "active mute",
              comment: "Waiting for upstream fix",
              expiresAt: "2999-01-01T00:00:00Z",
            },
            {
              resolution: "muted",
              messageRegexp: "outdated mute",
              comment: "Upstream deadline passed",
              expiresAt: "2000-01-01T00:00:00Z",
            },
          ],
        },
      }),
      rawTestResults: [
        makeRawFailedResult(knownTestName, knownTestFullName, { known: true }),
        makeRawFailedResult(mutedTestName, mutedTestFullName, { muted: true }),
        makeRawFailedResult(plainFailedTestName, plainFailedTestFullName, {}),
        makeRawResult(knownBrokenTestName, knownBrokenTestFullName, Status.BROKEN, { known: true }),
        makeRawFailedResult(mutedKnownTestName, mutedKnownTestFullName, { muted: true, known: true }),
        makeRawFailedResult(activeMutedTestName, activeMutedTestFullName, { message: "active mute" }),
        makeRawFailedResult(outdatedMutedTestName, outdatedMutedTestFullName, { message: "outdated mute" }),
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
    await expect(page.getByText("Muted forever")).toBeVisible();

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
    await expect(treePage.getLeafByTitle(activeMutedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(outdatedMutedTestName)).not.toBeVisible();
  });

  test("should filter tree by muted resolution", async ({ page }) => {
    await page.goto(bootstrap.url);

    await treePage.toggleMutedResolutionFilter();
    await expect(treePage.getLeafByTitle(mutedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(mutedKnownTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(activeMutedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(outdatedMutedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(knownTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(knownBrokenTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(plainFailedTestName)).not.toBeVisible();
  });

  test("should filter failed tab to unresolved failures", async ({ page }) => {
    await page.goto(bootstrap.url);

    await expect(treePage.metadataFailedLocator).toContainText("2");

    await treePage.clickTreeTab("failed");
    await expect(treePage.getLeafByTitle(plainFailedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(outdatedMutedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(activeMutedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(knownTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(mutedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(knownBrokenTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(mutedKnownTestName)).not.toBeVisible();
  });

  test("should filter tree by no resolution", async ({ page }) => {
    await page.goto(bootstrap.url);

    await treePage.toggleNoResolutionFilter();
    await expect(treePage.getLeafByTitle(plainFailedTestName)).toBeVisible();
    await expect(treePage.getLeafByTitle(knownTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(mutedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(knownBrokenTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(mutedKnownTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(activeMutedTestName)).not.toBeVisible();
    await expect(treePage.getLeafByTitle(outdatedMutedTestName)).not.toBeVisible();
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

  test("should show active configured mute deadline and mark expired mute as outdated", async ({ page }) => {
    await page.goto(bootstrap.url);

    await treePage.openTestResultByTitle(activeMutedTestName);
    await testResultPage.tabById("resolutionCategories").click();
    await expect(page.getByText(/Muted until/)).toBeVisible();

    await page.goto(bootstrap.url);
    await treePage.openTestResultByTitle(outdatedMutedTestName);
    await testResultPage.tabById("resolutionCategories").click();

    await expect(page.getByText("Outdated", { exact: true })).toBeVisible();
    await expect(page.getByText(/This failure is no longer ignored/)).toBeVisible();
  });
});
