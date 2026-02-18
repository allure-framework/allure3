import AwesomePlugin from "@allurereport/plugin-awesome";
import { expect, test } from "@playwright/test";
import { Stage, Status, label } from "allure-js-commons";
import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { type ReportBootstrap, bootstrapReport } from "../../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

const build100x100TableHtml = () => {
  const headerCells = Array.from({ length: 100 }, (_, columnIndex) => `<th>H${columnIndex + 1}</th>`).join("");
  const bodyRows = Array.from({ length: 100 }, (_, rowIndex) => {
    const rowCells = Array.from(
      { length: 100 },
      (__, columnIndex) => `<td>R${rowIndex + 1}C${columnIndex + 1}</td>`,
    ).join("");

    return `<tr>${rowCells}</tr>`;
  }).join("");

  return [
    "<h1>100x100 table showcase</h1>",
    "<p>This test renders a 100-column by 100-row HTML table.</p>",
    "<table>",
    "<thead>",
    `<tr>${headerCells}</tr>`,
    "</thead>",
    "<tbody>",
    bodyRows,
    "</tbody>",
    "</table>",
  ].join("");
};

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
      {
        name: "5 sample test with description",
        fullName: "sample.js#5 sample test with description",
        status: Status.PASSED,
        stage: Stage.FINISHED,
        start: now + 5000,
        stop: now + 6000,
        description: "This is a **markdown** description with `code` and _emphasis_.",
      },
      {
        name: "6 sample test with rich markdown description",
        fullName: "sample.js#6 sample test with rich markdown description",
        status: Status.PASSED,
        stage: Stage.FINISHED,
        start: now + 6000,
        stop: now + 7000,
        description: [
          "# Heading 1",
          "## Heading 2",
          "This is **bold** and _italic_ and `inline code`.",
          "",
          "- List item one",
          "- List item two",
          "",
          "1. First ordered",
          "2. Second ordered",
          "",
          "> Blockquote text",
          "",
          "[Example link](https://example.com)",
          "",
          "| Col1 | Col2 |",
          "|------|------|",
          "| A    | B    |",
          "",
          "```",
          "code block",
          "```",
        ].join("\n"),
      },
      {
        name: "7 sample test with 100x100 table description html",
        fullName: "sample.js#7 sample test with 100x100 table description html",
        status: Status.PASSED,
        stage: Stage.FINISHED,
        start: now + 7000,
        stop: now + 8000,
        descriptionHtml: build100x100TableHtml(),
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
    test("test with description displays rendered HTML", async () => {
      await treePage.clickLeafByTitle("5 sample test with description");
      await expect(testResultPage.descriptionLocator).toBeVisible();
      const descriptionFrame = testResultPage.page.frameLocator("[data-testid='test-result-description-frame']");
      await expect(descriptionFrame.locator("body")).toContainText("markdown");
      await expect(descriptionFrame.locator("body")).toContainText("code");
      await expect(descriptionFrame.locator("body")).toContainText("emphasis");

      const strongElement = descriptionFrame.locator("strong");
      await expect(strongElement).toContainText("markdown");
      await expect(descriptionFrame.locator("body")).not.toContainText("**markdown**");
      await expect(descriptionFrame.locator("body")).not.toContainText("`code`");
      await expect(descriptionFrame.locator("body")).not.toContainText("_emphasis_");
    });

    test("test with rich markdown description displays key prose elements", async () => {
      await treePage.clickLeafByTitle("6 sample test with rich markdown description");
      await expect(testResultPage.descriptionLocator).toBeVisible();
      const descriptionFrame = testResultPage.page.frameLocator("[data-testid='test-result-description-frame']");
      await expect(descriptionFrame.locator("p").first()).toBeVisible();
      await expect(descriptionFrame.locator("a[href='https://example.com']")).toContainText("Example link");
      await expect(descriptionFrame.locator("table")).toBeVisible();
      await expect(descriptionFrame.locator("pre code")).toContainText("code block");
    });

    test("100x100 HTML table keeps horizontal scroll and expected size", async () => {
      await treePage.clickLeafByTitle("7 sample test with 100x100 table description html");
      await expect(testResultPage.descriptionLocator).toBeVisible();
      const descriptionFrame = testResultPage.page.frameLocator("[data-testid='test-result-description-frame']");

      const table = descriptionFrame.locator("table");
      await expect(table).toBeVisible();
      await expect(table.locator("thead tr th")).toHaveCount(100);
      await expect(table.locator("tbody tr")).toHaveCount(100);
      await expect(table.locator("tbody tr").first().locator("td")).toHaveCount(100);

      const scrollInfo = await table.evaluate((node) => {
        const style = globalThis.getComputedStyle(node);
        return {
          clientWidth: node.clientWidth,
          overflowX: style.overflowX,
          scrollWidth: node.scrollWidth,
        };
      });

      expect(scrollInfo.scrollWidth).toBeGreaterThan(scrollInfo.clientWidth);
      expect(["auto", "scroll"]).toContain(scrollInfo.overflowX);
    });
  });
});
