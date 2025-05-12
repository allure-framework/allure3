import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { readFile } from "node:fs/promises";
import { dirname as pathDirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TestResultPage, TreePage } from "../pageObjects/index.js";
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

  test.describe("text attachment", () => {
    test.beforeEach(async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with attachments",
          appendHistory: true,
          history: [],
          historyPath: "history.jsonl",
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
      await testResultPage.toggleStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.codeAttachmentContentLocator).toHaveCount(1);
      await expect(testResultPage.codeAttachmentContentLocator.nth(0)).toHaveText("attachment content");

      await testResultPage.screenshot();
    });

    test("should render attachment in the test result attachments tab and allow to preview it", async () => {
      await treePage.clickNthLeaf(0);

      const attachmentsTab = testResultPage.tabById("attachments");

      await expect(attachmentsTab.getByTestId("counter")).toHaveText("1");

      await attachmentsTab.click();

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.codeAttachmentContentLocator).toHaveCount(1);
      await expect(testResultPage.codeAttachmentContentLocator.nth(0)).toHaveText("attachment content");

      await testResultPage.screenshot();
    });
  });

  test.describe("image attachment", () => {
    test.beforeEach(async ({ page }) => {
      const imageAttachment = await readFile(resolve(dirname, "../../fixtures/image.png"));

      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with attachments",
          appendHistory: true,
          history: [],
          historyPath: "history.jsonl",
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

    test("should render attachment in the test result body and allow to preview it", async ({ page }) => {
      await treePage.clickNthLeaf(0);
      await testResultPage.toggleStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.imageAttachmentContentLocator).toHaveCount(1);

      await testResultPage.screenshot();
    });

    test("should render attachment in the test result attachments tab and allow to preview it", async ({ page }) => {
      await treePage.clickNthLeaf(0);

      const attachmentsTab = testResultPage.tabById("attachments");

      await expect(attachmentsTab.getByTestId("counter")).toHaveText("1");

      await attachmentsTab.click();

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.imageAttachmentContentLocator).toHaveCount(1);

      await testResultPage.screenshot();
    });
  });

  test.describe("video attachment", () => {
    test.beforeEach(async ({ page }) => {
      const videoAttachment = await readFile(resolve(dirname, "../../fixtures/video.mp4"));

      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with attachments",
          appendHistory: true,
          history: [],
          historyPath: "history.jsonl",
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

    test("should render attachment in the test result body and allow to preview it", async ({ page }) => {
      await treePage.clickNthLeaf(0);
      await testResultPage.toggleStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.videoAttachmentContentLocator).toHaveCount(1);

      await testResultPage.screenshot();
    });

    test("should render attachment in the test result attachments tab and allow to preview it", async ({ page }) => {
      await treePage.clickNthLeaf(0);

      const attachmentsTab = testResultPage.tabById("attachments");

      await expect(attachmentsTab.getByTestId("counter")).toHaveText("1");

      await attachmentsTab.click();

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);

      await testResultPage.toggleAttachmentByTitle("attachment");

      await expect(testResultPage.videoAttachmentContentLocator).toHaveCount(1);

      await testResultPage.screenshot();
    });
  });
});
