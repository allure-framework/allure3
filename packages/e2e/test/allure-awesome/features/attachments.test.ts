import { readFile } from "node:fs/promises";
import { dirname as pathDirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import { epic, feature, label, Stage, Status, story } from "allure-js-commons";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

const dirname = pathDirname(fileURLToPath(import.meta.url));
const httpExchangeMime = "application/vnd.allure.http+json";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

test.describe("attachments", () => {
  test.beforeEach(async ({ browserName, page }) => {
    await label("env", browserName);
    await epic("coverage");
    await feature("attachments");
    await story("attachments");
    await label("coverage", "attachments");
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
      await testResultPage.ensureBodyStepsOpened();
      await testResultPage.expandStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(1);
      await testResultPage.toggleAttachmentByTitle("attachment");
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
      await testResultPage.ensureBodyStepsOpened();
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
      await testResultPage.ensureBodyStepsOpened();
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
      await testResultPage.ensureBodyStepsOpened();
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
      await testResultPage.ensureBodyStepsOpened();
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

  test.describe("HTTP Exchange attachment", () => {
    test.beforeEach(async ({ page }) => {
      const imageAttachment = await readFile(resolve(dirname, "../../fixtures/image.png"));
      const httpJson = {
        schemaVersion: 1,
        start: 1710000186400,
        stop: 1710000186487,
        request: {
          method: "POST",
          url: "https://api.example.com/v1/orders/42?dryRun=true",
          httpVersion: "HTTP/1.1",
          query: [{ name: "dryRun", value: "true" }],
          headers: [
            { name: "authorization", value: "__ALLURE_REDACTED__" },
            { name: "content-type", value: "application/json" },
          ],
          cookies: [
            { name: "sid", value: "__ALLURE_REDACTED__", httpOnly: true },
            { name: "theme", value: "dark", sameSite: "Lax" },
          ],
          body: {
            contentType: "application/json",
            encoding: "utf8",
            value: '{"name":"demo","quantity":1}',
            size: 28,
          },
        },
        response: {
          status: 201,
          statusText: "Created",
          httpVersion: "HTTP/1.1",
          headers: [{ name: "content-type", value: "text/html" }],
          cookies: [{ name: "session", value: "__ALLURE_REDACTED__", secure: true, httpOnly: true }],
          body: {
            contentType: "text/html",
            encoding: "utf8",
            value: "<script>window.__httpAttachmentXss = true</script>",
            size: 49,
          },
        },
      };
      const httpImage = {
        schemaVersion: 1,
        request: {
          method: "GET",
          url: "https://api.example.com/assets/logo.png",
        },
        response: {
          status: 200,
          statusText: "OK",
          body: {
            contentType: "image/png",
            encoding: "base64",
            value: imageAttachment.toString("base64"),
            size: imageAttachment.length,
          },
        },
      };
      const httpFormMultipartError = {
        schemaVersion: 1,
        request: {
          method: "POST",
          url: "https://api.example.com/upload",
          body: {
            contentType: "multipart/form-data",
            parts: [
              {
                name: "metadata",
                contentType: "application/json",
                headers: [{ name: "authorization", value: "__ALLURE_REDACTED__" }],
                value: '{"filename":"demo.txt"}',
              },
              {
                name: "file",
                fileName: "demo.txt",
                contentType: "text/plain",
                value: "__ALLURE_REDACTED__",
              },
            ],
          },
          trailers: [{ name: "grpc-status", value: "0" }],
        },
        response: {
          status: 503,
          statusText: "Service Unavailable",
          trailers: [{ name: "request-id", value: "req-123" }],
        },
        error: {
          name: "FetchError",
          message: "upstream reset",
          stack: "FetchError: upstream reset",
        },
      };

      bootstrap = await bootstrapReport({
        reportConfig: {
          name: "Allure report with HTTP Exchange attachments",
          appendHistory: true,
          knownIssuesPath: undefined,
        },
        testResults: [
          {
            name: "foo",
            fullName: "sample.test.js#test with HTTP Exchange attachment",
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
                    source: "attachment-http.httpexchange",
                    type: httpExchangeMime,
                    name: "HTTP JSON",
                  },
                  {
                    source: "attachment-http-image.httpexchange",
                    type: httpExchangeMime,
                    name: "HTTP image",
                  },
                  {
                    source: "attachment-http-error.httpexchange",
                    type: httpExchangeMime,
                    name: "HTTP multipart error",
                  },
                ],
              },
            ],
          },
        ],
        attachments: [
          {
            source: "attachment-http.httpexchange",
            content: Buffer.from(JSON.stringify(httpJson), "utf8"),
          },
          {
            source: "attachment-http-image.httpexchange",
            content: Buffer.from(JSON.stringify(httpImage), "utf8"),
          },
          {
            source: "attachment-http-error.httpexchange",
            content: Buffer.from(JSON.stringify(httpFormMultipartError), "utf8"),
          },
        ],
      });

      await page.goto(bootstrap.url);
    });

    test("should render HTTP Exchange attachments safely in the test result body and attachments tab", async ({
      page,
    }) => {
      await treePage.clickNthLeaf(0);
      await testResultPage.ensureBodyStepsOpened();
      await testResultPage.expandStepByTitle("bar");

      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(3);

      await testResultPage.toggleAttachmentByTitle("HTTP JSON");
      await expect(page.getByTestId("http-attachment-content").locator("[data-http-method]")).toHaveCount(1);
      await expect(page.getByTestId("http-attachment-content")).toContainText("POST");
      await expect(page.getByTestId("http-attachment-content")).toContainText(
        "https://api.example.com/v1/orders/42?dryRun=true",
      );
      await expect(page.getByTestId("http-attachment-content")).toContainText("201 Created");
      await expect(page.getByTestId("http-attachment-content")).toContainText("87 ms");
      await expect(page.getByTestId("http-attachment-content")).toContainText("Request");
      await expect(page.getByTestId("http-attachment-content")).toContainText("Response");
      await expect(page.getByTestId("http-attachment-content")).toContainText("Headers (2)");
      await page.getByText("Headers (2)").click();
      await expect(page.getByTestId("http-attachment-content")).toContainText("authorization");
      await expect(page.getByTestId("http-attachment-content")).not.toContainText("__ALLURE_REDACTED__");
      await expect(page.locator("[data-http-masked-value]")).toHaveCount(3);
      await expect(page.getByTestId("http-attachment-content")).toContainText(
        "<script>window.__httpAttachmentXss = true</script>",
      );
      await expect
        .poll(() =>
          page.evaluate(() => Boolean((window as Window & { __httpAttachmentXss?: boolean }).__httpAttachmentXss)),
        )
        .toBe(false);
      await expect(page.getByRole("link", { name: "Download request" })).toHaveCount(0);

      await testResultPage.toggleAttachmentByTitle("HTTP image");
      await testResultPage.waitForImageAttachmentLoaded();
      await expect(testResultPage.imageAttachmentContentLocator.locator("img")).toHaveAttribute(
        "src",
        /^data:image\/png;base64,/,
      );

      await testResultPage.toggleAttachmentByTitle("HTTP multipart error");
      const multipartAttachment = page.getByTestId("http-attachment-content").last();
      const multipartRequest = multipartAttachment.locator("[data-http-panel='request']");
      const multipartResponse = multipartAttachment.locator("[data-http-panel='response']");
      const metadataPart = multipartAttachment.locator("[data-http-part]").filter({ hasText: "metadata" });
      await expect(multipartAttachment).toContainText("Parts (2)");
      await expect(metadataPart).toContainText("application/json");
      await expect(metadataPart.locator("[data-http-part-headers]")).toContainText("authorization");
      await multipartRequest.getByText("Trailers (1)").click();
      await multipartResponse.getByText("Trailers (1)").click();
      await expect(multipartRequest).toContainText("grpc-status");
      await expect(multipartResponse).toContainText("request-id");
      await expect(multipartAttachment).toContainText("FetchError");

      await testResultPage.attachmentsTabLocator.click();
      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(3);
      await testResultPage.toggleAttachmentByTitle("HTTP JSON");
      await expect(page.getByTestId("http-attachment-content").first()).toContainText("POST");

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
      await testResultPage.ensureBodyStepsOpened();
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
        await popup.waitForURL("https://trace.playwright.dev/", { timeout: 5_000 });
        await expect(popup.getByText("start.test.ts")).toBeVisible({ timeout: 10_000 });
        return;
      }

      await expect(page.getByText("Playwright Trace Viewer | trace.zip", { exact: true })).toBeVisible();
    });
  });
});
