import { expect, test } from "@playwright/test";
import { layer } from "allure-js-commons";
import { Stage, Status } from "allure-js-commons";
import { type ReportBootstrap, boostrapReport, randomNumber } from "../utils/index.js";

let bootstrap: ReportBootstrap;

test.beforeAll(async () => {
  const now = Date.now();

  bootstrap = await boostrapReport({
    reportConfig: {
      name: "Sample allure report",
      appendHistory: false,
      history: undefined,
      historyPath: undefined,
      knownIssuesPath: undefined,
    },
    testResults: [
      {
        name: "0 sample passed test",
        fullName: "sample.js#0 sample passed test",
        status: Status.PASSED,
        stage: Stage.FINISHED,
        start: now,
        stop: now + 1000,
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

test.afterAll(async () => {
  await bootstrap.shutdown();
});

test.beforeEach(async ({ page }) => {
  await layer("e2e");
  await page.goto(bootstrap.url);
});

test.describe("allure-awesome", () => {
  test.describe("test results", () => {
    test("it's possible to navigate between tests results using navigation arrows", async ({ page }) => {
      const randomLeaf = page.getByTestId("tree-leaf").nth(randomNumber(0, 4));

      await randomLeaf.click();

      const testTitleText = await page.getByTestId("test-result-info-title").textContent();
      const navCounterText = await page.getByTestId("test-result-nav-current").textContent();
      const pressPrevArrow = await page.getByTestId("test-result-nav-next").isDisabled();

      if (pressPrevArrow) {
        await page.getByTestId("test-result-nav-prev").click();
      } else {
        await page.getByTestId("test-result-nav-next").click();
      }

      await expect(page.getByTestId("test-result-nav-current")).not.toHaveText(navCounterText);
      await expect(page.getByTestId("test-result-info-title")).not.toHaveText(testTitleText);

      if (pressPrevArrow) {
        await page.getByTestId("test-result-nav-next").click();
      } else {
        await page.getByTestId("test-result-nav-prev").click();
      }

      await expect(page.getByTestId("test-result-nav-current")).toHaveText(navCounterText);
      await expect(page.getByTestId("test-result-info-title")).toHaveText(testTitleText);
    });

    test("test result fullname copies to clipboard", async ({ page, context }) => {
      const passedLeaf = page.getByTestId("tree-leaf").nth(0);

      await passedLeaf.click();
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.getByTestId("test-result-fullname-copy").click();

      const handle = await page.evaluateHandle(() => globalThis.navigator.clipboard.readText());
      const clipboardContent = await handle.jsonValue();

      expect(clipboardContent).toEqual("sample.js#0 sample passed test");
    });

    test("failed test contains error message and stack", async ({ page }) => {
      await page.getByTestId("tree-leaf-status-failed").click();
      await expect(page.getByTestId("test-result-error-message")).toHaveText("Assertion error: Expected 1 to be 2");
      await expect(page.getByTestId("test-result-error-trace")).not.toBeVisible();
      await page.getByTestId("test-result-error-message").click();
      await expect(page.getByTestId("test-result-error-trace")).toHaveText("failed test trace");
    });

    test("broken test contains error message and stack", async ({ page }) => {
      await page.getByTestId("tree-leaf-status-broken").click();
      await expect(page.getByTestId("test-result-error-message")).toHaveText("An unexpected error");
      await expect(page.getByTestId("test-result-error-trace")).not.toBeVisible();
      await page.getByTestId("test-result-error-message").click();
      await expect(page.getByTestId("test-result-error-trace")).toHaveText("broken test trace");
    });
  });
});
