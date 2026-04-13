import { expect, test } from "@playwright/test";
import { feature, parameter } from "allure-js-commons";

import { GlobalsPage, TestResultPage } from "../../pageObjects";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";
import { makeReportConfig } from "../utils/mocks.js";

test.describe("globals", () => {
  let bootstrap: ReportBootstrap;
  let globalsPage: GlobalsPage;
  let testResultPage: TestResultPage;

  test.beforeEach(async ({ page, browserName }) => {
    globalsPage = new GlobalsPage(page);
    testResultPage = new TestResultPage(page);

    await feature("Global data");
    await parameter("browser", browserName);
  });

  test.afterEach(async () => {
    await bootstrap.shutdown();
  });

  test.describe("exit code", () => {
    test("should show only original exit code", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: "Test Report",
          appendHistory: false,
        }),
        testResults: [],
        globals: {
          exitCode: {
            original: 1,
          },
        },
      });

      await page.goto(bootstrap.url);

      const reportHeader = page.getByTestId("report-header");

      await expect(reportHeader.getByTestId("test-result-status-failed")).toBeVisible();
      await expect(page.getByTestId("report-data")).toContainText("with exit code 1");
      await globalsPage.attachScreenshot();
    });

    test("should show both exit codes", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: "Test Report",
          appendHistory: false,
        }),
        testResults: [],
        globals: {
          exitCode: {
            actual: 0,
            original: 1,
          },
        },
      });

      await page.goto(bootstrap.url);

      const reportHeader = page.getByTestId("report-header");

      await expect(reportHeader.getByTestId("test-result-status-passed")).toBeVisible();
      await expect(page.getByTestId("report-data")).toContainText("with exit code 0 (original 1)");
      await globalsPage.attachScreenshot();
    });

    test("shouldn't show global status and exit code when exit code isn't available", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: "Test Report",
          appendHistory: false,
        }),
        testResults: [],
        globals: {},
      });

      await page.goto(bootstrap.url);

      const reportHeader = page.getByTestId("report-header");

      await expect(reportHeader.getByTestId("report-data")).not.toContainText("with exit code");
      await expect(reportHeader.getByTestId("test-result-status-passed")).not.toBeVisible();
      await expect(reportHeader.getByTestId("test-result-status-failed")).not.toBeVisible();
      await globalsPage.attachScreenshot();
    });
  });

  test.describe("attachments", () => {
    test("should show empty state when no global attachments", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: "Test Report",
          appendHistory: false,
        }),
        testResults: [],
        globals: {
          attachments: {},
        },
      });

      await page.goto(bootstrap.url);

      await expect(globalsPage.globalAttachmentsTabLocator).toContainText("0");
      await globalsPage.globalAttachmentsTabLocator.click();
      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(0);

      await globalsPage.attachScreenshot();
    });

    test("should shows global attachments", async ({ page }) => {
      const fixtures = {
        attachments: {
          "test-file-1.txt": "Content of test file 1",
          "test-file-2.json": JSON.stringify({ test: "data" }),
        },
      };
      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: "Test Report",
          appendHistory: false,
        }),
        testResults: [],
        globals: {
          attachments: {
            "test-file-1.txt": Buffer.from(fixtures.attachments["test-file-1.txt"], "utf8"),
            "test-file-2.json": Buffer.from(fixtures.attachments["test-file-2.json"], "utf8"),
          },
        },
      });

      await page.goto(bootstrap.url);

      await expect(globalsPage.globalAttachmentsTabLocator).toContainText("2");
      await globalsPage.globalAttachmentsTabLocator.click();
      await expect(testResultPage.testResultAttachmentLocator).toHaveCount(2);

      await testResultPage.toggleAttachmentByTitle("test-file-1.txt");
      await testResultPage.toggleAttachmentByTitle("test-file-2.json");

      await expect(testResultPage.codeAttachmentContentLocator).toHaveCount(2);
      await expect(testResultPage.codeAttachmentContentLocator.nth(0)).toHaveText(
        fixtures.attachments["test-file-1.txt"],
      );
      await expect(testResultPage.codeAttachmentContentLocator.nth(1)).toHaveText(
        fixtures.attachments["test-file-2.json"],
      );

      await globalsPage.attachScreenshot();
    });

    test("should render grouped global attachments like quality gates", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: "Test Report",
          appendHistory: false,
          environments: {
            foo: {
              name: "foo",
              matcher: () => false,
            },
            bar: {
              name: "bar",
              matcher: () => false,
            },
          },
        }),
        testResults: [],
        globals: {
          attachments: {
            "default-global.txt": Buffer.from("default global attachment", "utf8"),
          },
          attachmentsByEnv: {
            foo: {
              "foo-global.txt": Buffer.from("foo global attachment", "utf8"),
            },
            bar: {
              "bar-global.txt": Buffer.from("bar global attachment", "utf8"),
            },
          },
        },
      });

      await page.goto(bootstrap.url);

      await expect(globalsPage.globalAttachmentsTabLocator).toContainText("3");
      await globalsPage.globalAttachmentsTabLocator.click();
      await expect(page.getByRole("button", { name: /^All\s+1$/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Environment: "default"/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Environment: "foo"/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Environment: "bar"/ })).toBeVisible();
      await expect(page.getByText("default-global.txt")).toBeVisible();
      await expect(page.getByText("foo-global.txt")).toBeVisible();
      await expect(page.getByText("bar-global.txt")).toBeVisible();

      await globalsPage.attachScreenshot();
    });
  });

  test.describe("errors", () => {
    test("should show empty state when no global errors", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: "Test Report",
          appendHistory: false,
        }),
        testResults: [],
        globals: {
          errors: [],
        },
      });

      await page.goto(bootstrap.url);

      await expect(globalsPage.globalErrorsTabLocator).toContainText("0");
      await globalsPage.globalErrorsTabLocator.click();
      await expect(page.getByTestId("test-result-error")).toHaveCount(0);

      await globalsPage.attachScreenshot();
    });

    test("should show global errors", async ({ page }) => {
      const testErrors = [
        {
          message: "First global error occurred",
          trace: "Error at line 1\n  at test.js:10:5",
        },
        {
          message: "Second global error with assertion failure",
          trace: "AssertionError: Expected true but got false\n  at test.js:20:10",
          actual: "false",
          expected: "true",
        },
      ];

      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: "Test Report",
          appendHistory: false,
        }),
        testResults: [],
        globals: {
          errors: testErrors,
        },
      });

      await page.goto(bootstrap.url);

      await expect(globalsPage.globalErrorsTabLocator).toContainText("2");
      await globalsPage.globalErrorsTabLocator.click();
      await expect(page.getByTestId("test-result-error")).toHaveCount(2);
      await expect(page.getByTestId("test-result-error").nth(0)).toContainText(testErrors[0].message);
      await expect(page.getByTestId("test-result-error").nth(1)).toContainText(testErrors[1].message);

      await globalsPage.attachScreenshot();
    });

    test("should render grouped global errors like quality gates", async ({ page }) => {
      bootstrap = await bootstrapReport({
        reportConfig: makeReportConfig({
          name: "Test Report",
          appendHistory: false,
          environments: {
            foo: {
              name: "foo",
              matcher: () => false,
            },
            bar: {
              name: "bar",
              matcher: () => false,
            },
          },
        }),
        testResults: [],
        globals: {
          errors: [
            {
              message: "default global error",
              trace: "Error: default global error",
            },
            {
              message: "foo global error",
              trace: "Error: foo global error",
              environment: "foo",
            },
            {
              message: "bar global error",
              trace: "Error: bar global error",
              environment: "bar",
            },
          ],
        },
      });

      await page.goto(bootstrap.url);

      await expect(globalsPage.globalErrorsTabLocator).toContainText("3");
      await globalsPage.globalErrorsTabLocator.click();
      await expect(page.getByRole("button", { name: /^All\s+1$/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Environment: "default"/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Environment: "foo"/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /Environment: "bar"/ })).toBeVisible();
      await expect(page.getByText("default global error")).toBeVisible();
      await expect(page.getByText("foo global error")).toBeVisible();
      await expect(page.getByText("bar global error")).toBeVisible();

      await globalsPage.attachScreenshot();
    });
  });
});
