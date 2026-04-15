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

const countStandaloneOverviewErrors = async (testResultPage: TestResultPage) => {
  return await testResultPage.page.getByTestId("test-result-error").evaluateAll((nodes) => {
    return nodes.filter((node) => !node.closest('[data-testid="test-result-step-content"]')).length;
  });
};

test.beforeAll(async () => {
  const now = Date.now();
  const assertionAttachmentFileName = "body-assertion.txt";
  const assertionAttachmentContent = "expected true to be false // Object.is equality";

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
      {
        name: "8 sample failed test with body attachment and error",
        fullName: "sample.js#8 sample failed test with body attachment and error",
        status: Status.FAILED,
        stage: Stage.FINISHED,
        start: now + 8000,
        stop: now + 9000,
        statusDetails: {
          message: "expected true to be false // Object.is equality",
          trace: "failed attachment body trace",
          actual: "true",
          expected: "false",
        },
        steps: [
          {
            name: "body step",
            status: Status.PASSED,
            stage: Stage.FINISHED,
            start: now + 8100,
            stop: now + 8200,
            parameters: [],
            steps: [],
            statusDetails: {},
          },
          {
            type: "attachment",
            name: "assertion",
            originalFileName: assertionAttachmentFileName,
            contentType: "text/plain",
          },
        ],
      },
      {
        name: "9 sample failed test with nested step error",
        fullName: "sample.js#9 sample failed test with nested step error",
        status: Status.FAILED,
        stage: Stage.FINISHED,
        start: now + 9000,
        stop: now + 10000,
        statusDetails: {
          message: "expected true to be false // Object.is equality",
          trace: "nested failed trace",
          actual: "true",
          expected: "false",
        },
        steps: [
          {
            name: "step 1",
            status: Status.FAILED,
            stage: Stage.FINISHED,
            start: now + 9100,
            stop: now + 9900,
            parameters: [],
            statusDetails: {
              message: "expected true to be false // Object.is equality",
              trace: "nested failed trace",
            },
            steps: [
              {
                name: "step 2",
                status: Status.FAILED,
                stage: Stage.FINISHED,
                start: now + 9200,
                stop: now + 9800,
                parameters: [],
                statusDetails: {
                  message: "expected true to be false // Object.is equality",
                  trace: "nested failed trace",
                },
                steps: [
                  {
                    name: "step 3",
                    status: Status.FAILED,
                    stage: Stage.FINISHED,
                    start: now + 9300,
                    stop: now + 9700,
                    parameters: [],
                    statusDetails: {
                      message: "expected true to be false // Object.is equality",
                      trace: "nested failed trace",
                    },
                    steps: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "10 sample broken test with nested step error",
        fullName: "sample.js#10 sample broken test with nested step error",
        status: Status.BROKEN,
        stage: Stage.FINISHED,
        start: now + 10000,
        stop: now + 11000,
        statusDetails: {
          message: "step 3 error",
          trace: "nested broken trace",
        },
        steps: [
          {
            name: "step 1",
            status: Status.BROKEN,
            stage: Stage.FINISHED,
            start: now + 10100,
            stop: now + 10900,
            parameters: [],
            statusDetails: {
              message: "step 3 error",
              trace: "nested broken trace",
            },
            steps: [
              {
                name: "step 2",
                status: Status.BROKEN,
                stage: Stage.FINISHED,
                start: now + 10200,
                stop: now + 10800,
                parameters: [],
                statusDetails: {
                  message: "step 3 error",
                  trace: "nested broken trace",
                },
                steps: [
                  {
                    name: "step 3",
                    status: Status.BROKEN,
                    stage: Stage.FINISHED,
                    start: now + 10300,
                    stop: now + 10700,
                    parameters: [],
                    statusDetails: {
                      message: "step 3 error",
                      trace: "nested broken trace",
                    },
                    steps: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    attachments: [
      {
        source: assertionAttachmentFileName,
        content: Buffer.from(assertionAttachmentContent),
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

      await treePage.openTestResultByNthLeaf(0);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await testResultPage.copyFullname();

      const handle = await page.evaluateHandle(() => globalThis.navigator.clipboard.readText());
      const clipboardContent = await handle.jsonValue();

      expect(clipboardContent).toEqual("sample.js#0 sample passed test");
    });

    test("failed test renders its test-level error in the body section", async () => {
      await treePage.openTestResultByTitle("1 sample failed test");

      const errorStep = testResultPage.getStepByName("Assertion error: Expected 1 to be 2");

      await expect(errorStep.locator).toBeVisible();
      await expect(errorStep.locator.getByTestId("test-result-step-title")).toHaveText(
        "Assertion error: Expected 1 to be 2",
      );
      await expect(testResultPage.page.getByText("No test steps information available")).not.toBeVisible();
      expect(await countStandaloneOverviewErrors(testResultPage)).toBe(0);

      await testResultPage.expandStepByTitle("Assertion error: Expected 1 to be 2");

      await expect(errorStep.stepDetailsLocator.getByTestId("test-result-error-message")).toHaveCount(0);
      await expect(errorStep.stepTraceLocator).toHaveText("failed test trace");
      await expect(testResultPage.errorDiffButtonLocator).toBeVisible();
      await testResultPage.errorDiffButtonLocator.click();
      await expect(testResultPage.errorDiffLocator).toBeVisible();
    });

    test("broken test renders its test-level error in the body section", async () => {
      await treePage.openTestResultByTitle("2 sample broken test");

      const errorStep = testResultPage.getStepByName("An unexpected error");

      await expect(errorStep.locator).toBeVisible();
      await expect(errorStep.locator.getByTestId("test-result-step-title")).toHaveText("An unexpected error");
      await expect(testResultPage.page.getByText("No test steps information available")).not.toBeVisible();
      expect(await countStandaloneOverviewErrors(testResultPage)).toBe(0);

      await testResultPage.expandStepByTitle("An unexpected error");

      await expect(errorStep.stepDetailsLocator.getByTestId("test-result-error-message")).toHaveCount(0);
      await expect(errorStep.stepTraceLocator).toHaveText("broken test trace");
    });

    test("test-level error stays last and duplicate-looking assertion attachment remains visible", async () => {
      await treePage.openTestResultByTitle("8 sample failed test with body attachment and error");

      const stepsRoot = testResultPage.page.getByTestId("test-result-steps-root").first();
      await expect(stepsRoot).toBeVisible();

      // The assertion attachment step should be visible
      const assertionStep = stepsRoot.getByTestId("test-result-step").filter({
        has: testResultPage.page.getByTestId("test-result-step-title").getByText("assertion", { exact: true }),
      });
      await expect(assertionStep).toBeVisible();

      // The test-level error step should be visible
      const errorStep = stepsRoot.getByTestId("test-result-step").filter({
        has: testResultPage.page
          .getByTestId("test-result-step-title")
          .getByText("expected true to be false // Object.is equality", { exact: true }),
      });
      await expect(errorStep).toBeVisible();

      // The test-level error must come after the assertion attachment in the DOM
      const isErrorAfterAssertion = await assertionStep.evaluate(
        (assertionNode, { errorTitle }) => {
          const stepsRoot = assertionNode.closest('[data-testid="test-result-steps-root"]');
          if (!stepsRoot) return false;
          const allSteps = Array.from(stepsRoot.querySelectorAll(':scope > [data-testid="test-result-step"]'));
          const assertionIdx = allSteps.indexOf(assertionNode as Element);
          const errorIdx = allSteps.findIndex((el) =>
            el.querySelector('[data-testid="test-result-step-title"]')?.textContent?.includes(errorTitle),
          );
          return errorIdx > assertionIdx;
        },
        { errorTitle: "expected true to be false" },
      );

      expect(isErrorAfterAssertion).toBe(true);
    });

    test("nested failed test renders the synthetic error only inside the deepest step", async () => {
      await treePage.openTestResultByTitle("9 sample failed test with nested step error");

      const stepsRoot = testResultPage.page.getByTestId("test-result-steps-root").first();
      const step1 = testResultPage.getStepByName("step 1");
      const step2 = step1.getSubstepByName("step 2");
      const step3 = step2.getSubstepByName("step 3");
      const nestedErrorStep = step3.getSubstepByName("expected true to be false // Object.is equality");

      await expect(stepsRoot.locator(':scope > [data-testid="test-result-step"]')).toHaveCount(1);
      await expect(step1.locator).toBeVisible();
      await expect(step2.locator).toBeVisible();
      await expect(step3.locator).toBeVisible();
      await expect(nestedErrorStep.locator).toBeVisible();
      await expect(step3.contentLocator.locator(':scope > [data-testid="test-result-error"]')).toHaveCount(0);
      await expect(nestedErrorStep.stepDetailsLocator.getByTestId("test-result-error-message")).toHaveCount(0);
      await expect(nestedErrorStep.stepTraceLocator).toHaveText("nested failed trace");
    });

    test("nested broken test renders the synthetic error only inside the deepest step", async () => {
      await treePage.openTestResultByTitle("10 sample broken test with nested step error");

      const stepsRoot = testResultPage.page.getByTestId("test-result-steps-root").first();
      const step1 = testResultPage.getStepByName("step 1");
      const step2 = step1.getSubstepByName("step 2");
      const step3 = step2.getSubstepByName("step 3");
      const nestedErrorStep = step3.getSubstepByName("step 3 error");

      await expect(stepsRoot.locator(':scope > [data-testid="test-result-step"]')).toHaveCount(1);
      await expect(step1.locator).toBeVisible();
      await expect(step2.locator).toBeVisible();
      await expect(step3.locator).toBeVisible();
      await expect(nestedErrorStep.locator).toBeVisible();
      await expect(step3.contentLocator.locator(':scope > [data-testid="test-result-error"]')).toHaveCount(0);
      await expect(nestedErrorStep.stepDetailsLocator.getByTestId("test-result-error-message")).toHaveCount(0);
      await expect(nestedErrorStep.stepTraceLocator).toHaveText("nested broken trace");
    });

    test("has a collapsable links section with links", async () => {
      const homepageLink = testResultPage.getLink(0);
      const docsLink = testResultPage.getLink(1);

      await treePage.openTestResultByTitle("0 sample passed test");
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
