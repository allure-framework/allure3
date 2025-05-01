import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeHistoryId, makeTestCaseId } from "../../utils/index.js";

let bootstrap: ReportBootstrap;

test.describe("flaky", () => {
  test.beforeAll(async () => {
    const now = Date.now();

    const reportName = "Sample allure report with flaky tests";
    const flakyTestFullname = "sample.js#Classic flaky test";
    const flakyTestName = "Classic flaky test";
    const testCaseId = makeTestCaseId(flakyTestFullname);
    const historyId = makeHistoryId(flakyTestFullname);

    bootstrap = await bootstrapReport({
      reportConfig: {
        name: reportName,
        appendHistory: true,
        history: [
          {
            uuid: "dc4d9432-ebef-4e0f-b121-37fcf0383023",
            name: reportName,
            timestamp: 1745926867897,
            knownTestCaseIds: [testCaseId, "54511e33b8d1887a829f815f468563a9"],
            testResults: {
              [historyId]: {
                id: "42dffbf3bb12f89807c85206c3f993a2",
                name: flakyTestName,
                fullName: flakyTestFullname,
                status: Status.FAILED,
                start: 1745926873782,
                stop: 1745926874782,
                duration: 1000,
                labels: [],
              },
              "54511e33b8d1887a829f815f468563a9.d41d8cd98f00b204e9800998ecf8427e": {
                id: "181c008c6d519b30bd3279dded351bd3",
                name: "Non-flaky test",
                fullName: "sample.js#Non-flaky test",
                status: "passed",
                start: 1745926877782,
                stop: 1745926878782,
                duration: 1000,
                labels: [],
              },
            },
            metrics: {},
          },
          {
            uuid: "b441fbc8-5222-4380-a325-d776436789f3",
            name: reportName,
            timestamp: 1745926884436,
            knownTestCaseIds: [testCaseId, "54511e33b8d1887a829f815f468563a9"],
            testResults: {
              "54511e33b8d1887a829f815f468563a9.d41d8cd98f00b204e9800998ecf8427e": {
                id: "67175da7a4eded923ad6d8dda76f2838",
                name: "Non-flaky test",
                fullName: "sample.js#Non-flaky test",
                status: "passed",
                start: 1745926894322,
                stop: 1745926895322,
                duration: 1000,
                labels: [],
              },
              [historyId]: {
                id: "1373936b78555e2d7646b6f7eccb5b83",
                name: flakyTestName,
                fullName: flakyTestFullname,
                status: Status.PASSED,
                start: 1745926890322,
                stop: 1745926891322,
                duration: 1000,
                labels: [],
              },
            },
            metrics: {},
          },
          {
            uuid: "47b06933-e2a4-401a-b873-648885f033a2",
            name: reportName,
            timestamp: 1745926887428,
            knownTestCaseIds: [testCaseId, "54511e33b8d1887a829f815f468563a9"],
            testResults: {
              "54511e33b8d1887a829f815f468563a9.d41d8cd98f00b204e9800998ecf8427e": {
                id: "b40702a85e54a2f8dcc6cfdf791170dd",
                name: "Non-flaky test",
                fullName: "sample.js#Non-flaky test",
                status: "passed",
                start: 1745926897309,
                stop: 1745926898309,
                duration: 1000,
                labels: [],
              },
              [historyId]: {
                id: "218637ff0c630613e70a149cda54bdf2",
                name: flakyTestName,
                fullName: flakyTestFullname,
                status: Status.FAILED,
                start: 1745926893309,
                stop: 1745926894309,
                duration: 1000,
                labels: [],
              },
            },
            metrics: {},
          },
        ],
        historyPath: "history.jsonl",
        knownIssuesPath: undefined,
      },
      testResults: [
        // Classic flaky test
        {
          name: flakyTestName,
          fullName: flakyTestFullname,
          historyId,
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now + 4000,
          stop: now + 5000,
        },
        // Non-flaky test
        {
          name: "Non-flaky test",
          fullName: "sample.js#Non-flaky test",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now + 10000,
          stop: now + 11000,
        },
      ],
    });
  });

  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);
    await page.goto(bootstrap.url);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("should be able to filter flaky tests with flaky status using flaky filter", async ({ page }) => {
    await expect(page.getByTestId("tree-leaf")).toHaveCount(2);

    // Open filters
    await page.getByTestId("filters-button").click();

    // Select flaky filter
    await page.getByTestId("flaky-filter").click();

    // Verify only tests with flaky status are visible
    const treeLeaves = page.getByTestId("tree-leaf");
    await expect(treeLeaves).toHaveCount(1);

    // Verify the test names are correct for tests with flaky status
    await expect(page.getByText("Classic flaky test", { exact: true })).toBeVisible();
    await expect(page.getByText("Non-flaky test", { exact: true })).not.toBeVisible();

    // Disable flaky filter
    await page.getByTestId("flaky-filter").click();

    // Verify all tests are visible again
    await expect(page.getByTestId("tree-leaf")).toHaveCount(2);
  });

  test("should show flaky icon only for flaky tests in the tree", async ({ page }) => {
    const treeLeaves = page.getByTestId("tree-leaf");

    // Classic flaky test
    const classicFlaky = treeLeaves
      .filter({ has: page.getByText("Classic flaky test", { exact: true }) })
      .getByTestId("tree-item-meta-icon-flaky");
    await expect(classicFlaky).toBeVisible();

    // Non-flaky test
    const nonFlaky = treeLeaves
      .filter({ has: page.getByText("Non-flaky test", { exact: true }) })
      .getByTestId("tree-item-meta-icon-flaky");
    await expect(nonFlaky).not.toBeVisible();
  });

  test("metadata shows correct count of flaky tests", async ({ page }) => {
    await expect(page.getByTestId("metadata-item-total").getByTestId("metadata-value")).toHaveText("2");
    await expect(page.getByTestId("metadata-item-flaky").getByTestId("metadata-value")).toHaveText("1");
  });
});
