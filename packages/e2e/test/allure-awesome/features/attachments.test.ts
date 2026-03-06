import { readFile } from "node:fs/promises";
import { dirname as pathDirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

const dirname = pathDirname(fileURLToPath(import.meta.url));

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

test.describe("attachments", () => {
  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);

    treePage = new TreePage(page);
    testResultPage = new TestResultPage(page);
  });

  test.afterAll(async () => {
    await bootstrap?.shutdown?.();
  });

  test.describe("commons", () => {
    test.beforeEach(async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with attachments",
          appendHistory: true,
          knownIssuesPath: undefined,
        },
        testResults: [
          {
            name: "foo",
            fullName: "sample.test.js#test with image attachment",
            historyId: "",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: Date.now(),
            stop: Date.now() + 1000,
            steps: [
              {
                name: "bar",
                status: Status.PASSED,
                stage: Stage.FINISHED,
                parameters: [],
                steps: [],
                statusDetails: {},
                attachments: [
                  {
                    source: "attachment.txt",
                    type: "text/plain",
                    name: "attachment",
                  },
                ],
              },
            ],
          },
        ],
        attachments: [],
      });

      await page.goto(bootstrap.url);
    });

    test('should render "missed" label for attachments which don\'t exist', async () => {
      await treePage.clickNthLeaf(0);
      await testResultPage.expandStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);
      await expect(
        testResultPage.testResultAttachmentLocator.nth(0).getByTestId("test-result-attachment-missed"),
      ).toBeVisible();

      await testResultPage.attachScreenshot();
    });
  });

  test.describe("text attachment", () => {
    test.beforeEach(async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with attachments",
          appendHistory: true,
          knownIssuesPath: undefined,
        },
        testResults: [
          {
            name: "foo",
            fullName: "sample.test.js#test with image attachment",
            historyId: "",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: Date.now(),
            stop: Date.now() + 1000,
            steps: [
              {
                name: "bar",
                status: Status.PASSED,
                stage: Stage.FINISHED,
                parameters: [],
                steps: [],
                statusDetails: {},
                attachments: [
                  {
                    source: "attachment.txt",
                    type: "text/plain",
                    name: "attachment",
                  },
                ],
              },
            ],
          },
        ],
        attachments: [
          {
            source: "attachment.txt",
            content: Buffer.from("attachment content", "utf8"),
          },
        ],
      });

      await page.goto(bootstrap.url);
    });

    test("should render attachment in the test result body and allow to preview it", async () => {
      await treePage.clickNthLeaf(0);
      await testResultPage.expandStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.codeAttachmentContentLocator).toHaveCount(1);
      await expect(testResultPage.codeAttachmentContentLocator.nth(0)).toContainText("attachment content");

      await testResultPage.attachScreenshot();
    });

    test("should render attachment in the test result attachments tab and allow to preview it", async () => {
      await treePage.clickNthLeaf(0);

      const attachmentsTab = testResultPage.tabById("attachments");

      await expect(attachmentsTab.getByTestId("counter")).toHaveText("1");

      await attachmentsTab.click();

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.codeAttachmentContentLocator).toHaveCount(1);
      await expect(testResultPage.codeAttachmentContentLocator.nth(0)).toContainText("attachment content");

      await testResultPage.attachScreenshot();
    });
  });

  test.describe("code attachment", () => {
    test.beforeEach(async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with attachments",
          appendHistory: true,
          knownIssuesPath: undefined,
        },
        testResults: [
          {
            name: "foo",
            fullName: "sample.test.js#test with image attachment",
            historyId: "",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: Date.now(),
            stop: Date.now() + 1000,
            steps: [
              {
                name: "bar",
                status: Status.PASSED,
                stage: Stage.FINISHED,
                parameters: [],
                steps: [],
                statusDetails: {},
                attachments: [
                  {
                    source: "attachment.js",
                    type: "text/javascript",
                    name: "attachment",
                  },
                ],
              },
            ],
          },
        ],
        attachments: [
          {
            source: "attachment.js",
            content: Buffer.from("console.log('Hello world!');", "utf8"),
          },
        ],
      });

      await page.goto(bootstrap.url);
    });

    test("should render attachment in the test result body and allow to preview it", async () => {
      await treePage.clickNthLeaf(0);
      await testResultPage.expandStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.codeAttachmentContentLocator).toHaveCount(1);
      await expect(testResultPage.codeAttachmentContentLocator.nth(0)).toContainText("console.log('Hello world!');");

      await testResultPage.attachScreenshot();
    });

    test("should render attachment in the test result attachments tab and allow to preview it", async () => {
      await treePage.clickNthLeaf(0);

      const attachmentsTab = testResultPage.tabById("attachments");

      await expect(attachmentsTab.getByTestId("counter")).toHaveText("1");

      await attachmentsTab.click();

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.codeAttachmentContentLocator).toHaveCount(1);
      await expect(testResultPage.codeAttachmentContentLocator.nth(0)).toContainText("console.log('Hello world!');");

      await testResultPage.attachScreenshot();
    });
  });

  test.describe("image attachment", () => {
    test.beforeEach(async ({ page }) => {
      const imageAttachment = await readFile(resolve(dirname, "../../fixtures/image.png"));

      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with attachments",
          appendHistory: true,
          knownIssuesPath: undefined,
        },
        testResults: [
          {
            name: "foo",
            fullName: "sample.test.js#test with image attachment",
            historyId: "",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: Date.now(),
            stop: Date.now() + 1000,
            steps: [
              {
                name: "bar",
                status: Status.PASSED,
                stage: Stage.FINISHED,
                parameters: [],
                steps: [],
                statusDetails: {},
                attachments: [
                  {
                    source: "attachment.png",
                    type: "image/png",
                    name: "attachment",
                  },
                ],
              },
            ],
          },
        ],
        attachments: [
          {
            source: "attachment.png",
            content: imageAttachment,
          },
        ],
      });

      await page.goto(bootstrap.url);
    });

    test("should render attachment in the test result body and allow to preview it", async () => {
      await treePage.clickNthLeaf(0);
      await testResultPage.expandStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1, { timeout: 10000 });

      await testResultPage.toggleAttachmentByTitle("attachment");

      await testResultPage.waitForImageAttachmentLoaded(15000);

      await testResultPage.attachScreenshot();
    });

    test("should render attachment in the test result attachments tab and allow to preview it", async () => {
      await treePage.clickNthLeaf(0);

      const attachmentsTab = testResultPage.tabById("attachments");

      await expect(attachmentsTab.getByTestId("counter")).toHaveText("1");

      await attachmentsTab.click();

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1, { timeout: 10000 });

      await testResultPage.toggleAttachmentByTitle("attachment");

      await testResultPage.waitForImageAttachmentLoaded(15000);

      await testResultPage.attachScreenshot();
    });
  });

  test.describe("video attachment", () => {
    test.beforeEach(async ({ page }) => {
      const videoAttachment = await readFile(resolve(dirname, "../../fixtures/video.mp4"));

      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with attachments",
          appendHistory: true,
          knownIssuesPath: undefined,
        },
        testResults: [
          {
            name: "foo",
            fullName: "sample.test.js#test with image attachment",
            historyId: "",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: Date.now(),
            stop: Date.now() + 1000,
            steps: [
              {
                name: "bar",
                status: Status.PASSED,
                stage: Stage.FINISHED,
                parameters: [],
                steps: [],
                statusDetails: {},
                attachments: [
                  {
                    source: "attachment.mp4",
                    type: "video/mp4",
                    name: "attachment",
                  },
                ],
              },
            ],
          },
        ],
        attachments: [
          {
            source: "attachment.mp4",
            content: videoAttachment,
          },
        ],
      });

      await page.goto(bootstrap.url);
    });

    test("should render attachment in the test result body and allow to preview it", async () => {
      await treePage.clickNthLeaf(0);
      await testResultPage.expandStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.videoAttachmentContentLocator).toHaveCount(1);

      await testResultPage.attachScreenshot();
    });

    test("should render attachment in the test result attachments tab and allow to preview it", async () => {
      await treePage.clickNthLeaf(0);

      const attachmentsTab = testResultPage.tabById("attachments");

      await expect(attachmentsTab.getByTestId("counter")).toHaveText("1");

      await attachmentsTab.click();

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.videoAttachmentContentLocator).toHaveCount(1);

      await testResultPage.attachScreenshot();
    });
  });

  test.describe("playwright trace attachment", () => {
    test.beforeEach(async ({ page }) => {
      const playwrightTraceAttachment = await readFile(resolve(dirname, "../../fixtures/playwright-trace.zip"));

      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with Playwright trace attachment",
          appendHistory: true,
          knownIssuesPath: undefined,
        },
        testResults: [
          {
            name: "foo",
            fullName: "sample.test.js#test with playwright trace attachment",
            historyId: "",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: Date.now(),
            stop: Date.now() + 1000,
            steps: [
              {
                name: "bar",
                status: Status.PASSED,
                stage: Stage.FINISHED,
                parameters: [],
                steps: [],
                statusDetails: {},
                attachments: [
                  {
                    source: "trace.zip",
                    type: "application/vnd.allure.playwright-trace",
                    name: "trace",
                  },
                ],
              },
            ],
          },
        ],
        attachments: [
          {
            source: "trace.zip",
            content: playwrightTraceAttachment,
          },
        ],
      });

      await page.goto(bootstrap.url);
    });

    test("opens Playwright Trace in a new tab", async ({ page }) => {
      await treePage.clickNthLeaf(0);
      await testResultPage.toggleStepByTitle("bar");

      const popupPromise = page
        .context()
        .waitForEvent("page", { timeout: 3_000 })
        .catch(() => null);

      await testResultPage.testResultAttachmentLocator
        .filter({ has: page.getByText("trace", { exact: true }) })
        .getByRole("button")
        .nth(0)
        .click();

      const popup = await popupPromise;

      if (popup) {
        await popup.waitForURL(/https:\/\/trace\.playwright\.dev\/next\//, { timeout: 5_000 });
        return;
      }

      await expect(page.getByText("Playwright Trace Viewer | trace.zip", { exact: true })).toBeVisible();
    });
  });
});
