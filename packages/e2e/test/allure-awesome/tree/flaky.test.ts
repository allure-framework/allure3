import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TreePage } from "../../pageObjects/index.js";
import { makeHistoryId, makeTestCaseId } from "../../utils/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;

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
            timestamp: now,
            knownTestCaseIds: [testCaseId, "54511e33b8d1887a829f815f468563a9"],
            testResults: {
              [historyId]: {
                id: "42dffbf3bb12f89807c85206c3f993a2",
                name: flakyTestName,
                fullName: flakyTestFullname,
                status: Status.FAILED,
                start: now + 1000,
                stop: now + 2000,
                duration: 1000,
                labels: [],
              },
              "54511e33b8d1887a829f815f468563a9.d41d8cd98f00b204e9800998ecf8427e": {
                id: "181c008c6d519b30bd3279dded351bd3",
                name: "Non-flaky test",
                fullName: "sample.js#Non-flaky test",
                status: "passed",
                start: now + 3000,
                stop: now + 4000,
                duration: 1000,
                labels: [],
              },
            },
            metrics: {},
          },
          {
            uuid: "b441fbc8-5222-4380-a325-d776436789f3",
            name: reportName,
            timestamp: now + 5000,
            knownTestCaseIds: [testCaseId, "54511e33b8d1887a829f815f468563a9"],
            testResults: {
              "54511e33b8d1887a829f815f468563a9.d41d8cd98f00b204e9800998ecf8427e": {
                id: "67175da7a4eded923ad6d8dda76f2838",
                name: "Non-flaky test",
                fullName: "sample.js#Non-flaky test",
                status: "passed",
                start: now + 6000,
                stop: now + 7000,
                duration: 1000,
                labels: [],
              },
              [historyId]: {
                id: "1373936b78555e2d7646b6f7eccb5b83",
                name: flakyTestName,
                fullName: flakyTestFullname,
                status: Status.PASSED,
                start: now + 8000,
                stop: now + 9000,
                duration: 1000,
                labels: [],
              },
            },
            metrics: {},
          },
          {
            uuid: "47b06933-e2a4-401a-b873-648885f033a2",
            name: reportName,
            timestamp: now + 10000,
            knownTestCaseIds: [testCaseId, "54511e33b8d1887a829f815f468563a9"],
            testResults: {
              "54511e33b8d1887a829f815f468563a9.d41d8cd98f00b204e9800998ecf8427e": {
                id: "b40702a85e54a2f8dcc6cfdf791170dd",
                name: "Non-flaky test",
                fullName: "sample.js#Non-flaky test",
                status: "passed",
                start: now + 11000,
                stop: now + 12000,
                duration: 1000,
                labels: [],
              },
              [historyId]: {
                id: "218637ff0c630613e70a149cda54bdf2",
                name: flakyTestName,
                fullName: flakyTestFullname,
                status: Status.FAILED,
                start: now + 13000,
                stop: now + 14000,
                duration: 1000,
                labels: [],
              },
            },
            metrics: {},
          },
          {
            uuid: "47b06933-e2a4-401a-b873-648885f033a2",
            name: reportName,
            timestamp: now + 15000,
            knownTestCaseIds: [testCaseId, "54511e33b8d1887a829f815f468563a9"],
            testResults: {
              "54511e33b8d1887a829f815f468563a9.d41d8cd98f00b204e9800998ecf8427e": {
                id: "b40702a85e54a2f8dcc6cfdf791170dd",
                name: "Non-flaky test",
                fullName: "sample.js#Non-flaky test",
                status: "passed",
                start: now + 16000,
                stop: now + 17000,
                duration: 1000,
                labels: [],
              },
              [historyId]: {
                id: "218637ff0c630613e70a149cda54bdf3",
                name: flakyTestName,
                fullName: flakyTestFullname,
                status: Status.FAILED,
                start: now + 18000,
                stop: now + 19000,
                duration: 1000,
                labels: [],
              },
            },
            metrics: {},
          },
          {
            uuid: "47b06933-e2a4-401a-b873-648885f033a3",
            name: reportName,
            timestamp: now + 20000,
            knownTestCaseIds: [testCaseId, "54511e33b8d1887a829f815f468563a9"],
            testResults: {
              "54511e33b8d1887a829f815f468563a9.d41d8cd98f00b204e9800998ecf8427e": {
                id: "b40702a85e54a2f8dcc6cfdf791170dd",
                name: "Non-flaky test",
                fullName: "sample.js#Non-flaky test",
                status: "passed",
                start: now + 21000,
                stop: now + 22000,
                duration: 1000,
                labels: [],
              },
              [historyId]: {
                id: "218637ff0c630613e70a149cda54bdf3",
                name: flakyTestName,
                fullName: flakyTestFullname,
                status: Status.FAILED,
                start: now + 23000,
                stop: now + 24000,
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

    treePage = new TreePage(page);

    await page.goto(bootstrap.url);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test("should be able to filter flaky tests with flaky status using flaky filter", async () => {
    await expect(treePage.leafLocator).toHaveCount(2);
    await treePage.toggleFlakyFilter();
    await expect(treePage.leafLocator).toHaveCount(1);
    await expect(treePage.getLeafByTitle("Classic flaky test")).toBeVisible();
    await expect(treePage.getLeafByTitle("Non-flaky test")).not.toBeVisible();
    await treePage.toggleFlakyFilter();
    await expect(treePage.leafLocator).toHaveCount(2);
  });

  test("should show flaky icon only for flaky tests in the tree", async () => {
    await expect(treePage.getLeafByTitle("Classic flaky test").getByTestId("tree-item-meta-icon-flaky")).toBeVisible();
    await expect(treePage.getLeafByTitle("Non-flaky test").getByTestId("tree-item-meta-icon-flaky")).not.toBeVisible();
  });

  test("metadata shows correct count of flaky tests", async () => {
    const { total, flaky } = await treePage.getMetadataValues();

    expect(total).toBe("2");
    expect(flaky).toBe("1");
  });
});
