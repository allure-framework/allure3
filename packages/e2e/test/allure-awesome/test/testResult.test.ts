import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

test.beforeAll(async () => {
  const now = Date.now();

  bootstrap = await bootstrapReport({
    reportConfig: {
      name: "Sample allure report",
      appendHistory: false,
      knownIssuesPath: undefined,
      plugins: [
        {
          id: "awesome",
          enabled: true,
          plugin: new AwesomePlugin(),
          options: {},
        },
      ],
    },
    testResults: [
      {
        name: "0 sample passed test",
        fullName: "sample.js#0 sample passed test",
        status: Status.PASSED,
        stage: Stage.FINISHED,
        start: now,
        stop: now + 1000,
        links: [
          {
            url: "https://allurereport.org/",
            name: "Homepage",
          },
          {
            url: "https://allurereport.org/docs/",
          },
        ],
      },
      {
        name: "1 sample failed test",
        fullName: "sample.js#1 sample failed test",
        status: Status.FAILED,
        stage: Stage.FINISHED,
        start: now + 1000,
        stop: now + 2000,
        statusDetails: {
          message: "Assertion error: Expected 1 to be 2",
          trace: "failed test trace",
          actual: "some actual result",
          expected: "some expected result",
        },
      },
      {
        name: "2 sample broken test",
        fullName: "sample.js#2 sample broken test",
        status: Status.BROKEN,
        stage: Stage.FINISHED,
        start: now + 2000,
        stop: now + 3000,
        statusDetails: {
          message: "An unexpected error",
          trace: "broken test trace",
        },
      },
      {
        name: "3 sample skipped test",
        fullName: "sample.js#3 sample skipped test",
        start: now + 3000,
        stop: now + 3000,
        status: Status.SKIPPED,
      },
      {
        name: "4 sample unknown test",
        fullName: "sample.js#4 sample unknown test",
        status: undefined,
        start: now + 4000,
        stage: Stage.PENDING,
      },
    ],
  });
});

test.beforeEach(async ({ page, browserName }) => {
  await label("env", browserName);

  treePage = new TreePage(page);
  testResultPage = new TestResultPage(page);

  await page.goto(bootstrap.url);
});

test.afterAll(async () => {
  await bootstrap.shutdown();
});

test.describe("allure-awesome", () => {
  test.describe("test results", () => {
    test("it's possible to navigate between tests results using navigation arrows", async () => {
      await treePage.clickRandomLeaf();

      const testTitleText = await testResultPage.titleLocator.textContent();
      const navCounterText = await testResultPage.navCurrentLocator.textContent();
      const pressNextButton = await testResultPage.navPrevLocator.isDisabled();

      if (!pressNextButton) {
        await testResultPage.clickPrevTestResult();
      } else {
        await testResultPage.clickNextTestResult();
      }

      await expect(testResultPage.navCurrentLocator).not.toHaveText(navCounterText);
      await expect(testResultPage.titleLocator).not.toHaveText(testTitleText);

      if (!pressNextButton) {
        await testResultPage.clickNextTestResult();
      } else {
        await testResultPage.clickPrevTestResult();
      }

      await expect(testResultPage.navCurrentLocator).toHaveText(navCounterText);
      await expect(testResultPage.titleLocator).toHaveText(testTitleText);
    });

    test("test result fullname copies to clipboard", async ({ browserName, page, context }) => {
      test.skip(browserName !== "chromium", "Only chromium supports clipboard API");

      await treePage.clickNthLeaf(0);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await testResultPage.copyFullname();

      const handle = await page.evaluateHandle(() => globalThis.navigator.clipboard.readText());
      const clipboardContent = await handle.jsonValue();

      expect(clipboardContent).toEqual("sample.js#0 sample passed test");
    });

    test("failed test contains error message and stack", async () => {
      await treePage.leafStatusFailedLocator.click();
      await expect(testResultPage.errorMessageLocator).toHaveText("Assertion error: Expected 1 to be 2");
      await expect(testResultPage.errorTraceLocator).not.toBeVisible();
      await testResultPage.errorMessageLocator.click();
      await expect(testResultPage.errorTraceLocator).toHaveText("failed test trace");
    });

    test("failed test contains error actual/expected comparison", async () => {
      await treePage.leafStatusFailedLocator.click();
      await expect(testResultPage.errorMessageLocator).toHaveText("Assertion error: Expected 1 to be 2");
      await expect(testResultPage.errorTraceLocator).not.toBeVisible();
      await expect(testResultPage.errorDiffButtonLocator).toBeVisible();
      await testResultPage.errorDiffButtonLocator.click();
      await expect(testResultPage.errorDiffLocator).toBeVisible();
    });

    test("broken test contains error message and stack", async () => {
      await treePage.leafStatusBrokenLocator.click();
      await expect(testResultPage.errorMessageLocator).toHaveText("An unexpected error");
      await expect(testResultPage.errorTraceLocator).not.toBeVisible();
      await testResultPage.errorMessageLocator.click();
      await expect(testResultPage.errorTraceLocator).toHaveText("broken test trace");
    });

    test("has a collapsable links section with links", async () => {
      const homepageLink = testResultPage.getLink(0);
      const docsLink = testResultPage.getLink(1);

      await treePage.clickLeafByTitle("0 sample passed test");
      await expect(testResultPage.linksLocator).toBeVisible();

      // Collapse
      await testResultPage.toggleLinkSection();

      await expect(homepageLink.locator).not.toBeVisible();
      await expect(docsLink.locator).not.toBeVisible();

      // Expand
      await testResultPage.toggleLinkSection();

      await expect(homepageLink.locator).toBeVisible();
      await expect(homepageLink.iconLocator).toBeVisible();
      await expect(homepageLink.anchorLocator).toHaveAttribute("href", "https://allurereport.org/");
      await expect(homepageLink.anchorLocator).toHaveText("Homepage");

      await expect(docsLink.locator).toBeVisible();
      await expect(docsLink.iconLocator).toBeVisible();
      await expect(docsLink.anchorLocator).toHaveAttribute("href", "https://allurereport.org/docs/");
      await expect(docsLink.anchorLocator).toHaveText("https://allurereport.org/docs/");
    });
  });
});
