import { epic, feature, label, Stage, Status, story } from "allure-js-commons";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { expect, test } from "../../playwright.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

const now = Date.now();
const testResultUuid = "step-toggle-test-result";

test.beforeEach(async ({ page, browserName }) => {
  await label("env", browserName);
  await epic("coverage");
  await feature("ui-state");
  await story("stepsSubtreeToggle");
  await label("coverage", "ui-state");
  treePage = new TreePage(page);
  testResultPage = new TestResultPage(page);

  bootstrap = await bootstrapReport(
    {
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
      },
      rawTestResults: [
        {
          uuid: testResultUuid,
          name: "step toggle test",
          fullName: "sample.js#step toggle test",
          historyId: "step-toggle",
          testCaseId: "step-toggle",
          status: Status.PASSED,
          stage: Stage.FINISHED,
          start: now,
          stop: now + 1000,
          steps: [
            {
              name: "level 1",
              status: Status.PASSED,
              stage: Stage.FINISHED,
              start: now + 100,
              stop: now + 900,
              statusDetails: {},
              attachments: [],
              parameters: [],
              steps: [
                {
                  name: "level 2",
                  status: Status.PASSED,
                  stage: Stage.FINISHED,
                  start: now + 200,
                  stop: now + 800,
                  statusDetails: {},
                  attachments: [],
                  parameters: [],
                  steps: [
                    {
                      name: "level 3",
                      status: Status.PASSED,
                      stage: Stage.FINISHED,
                      start: now + 300,
                      stop: now + 700,
                      statusDetails: {},
                      attachments: [],
                      parameters: [],
                      steps: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      rawTestResultContainers: [
        {
          children: [testResultUuid],
          befores: [
            {
              name: "setup fixture",
              status: Status.PASSED,
              stage: Stage.FINISHED,
              start: now,
              stop: now + 50,
              steps: [],
            },
          ],
          afters: [
            {
              name: "teardown fixture",
              status: Status.PASSED,
              stage: Stage.FINISHED,
              start: now + 950,
              stop: now + 1000,
              steps: [],
            },
          ],
        },
      ],
    },
    {
      stepTreeExpansion: "collapsed",
    },
  );

  await page.goto(bootstrap.url);
  await treePage.clickNthLeaf(0);
});

test.afterAll(async () => {
  await bootstrap?.shutdown?.();
});

test("should collapse setup, body and teardown sections by default", async () => {
  const setupFixture = testResultPage.getStepByName("setup fixture");
  const level1Step = testResultPage.getStepByName("level 1");
  const teardownFixture = testResultPage.getStepByName("teardown fixture");

  await expect(setupFixture.locator).toHaveCount(0);
  await expect(level1Step.locator).toHaveCount(0);
  await expect(teardownFixture.locator).toHaveCount(0);

  await testResultPage.setupDropdownLocator.click();
  await expect(setupFixture.locator).toHaveCount(1);

  await testResultPage.teardownDropdownLocator.click();
  await expect(teardownFixture.locator).toHaveCount(1);

  await expect(level1Step.locator).toHaveCount(0);
});

for (const layout of ["default layout", "narrow scroll pane"]) {
  test(`should keep the body toggle in place when its tooltip appears (${layout})`, async ({ page }) => {
    const toggle = testResultPage.stepsSubtreeToggleLocator;
    const label = "Expand first level";

    if (layout === "narrow scroll pane") {
      const header = page.locator("[data-tr-focus-id]").filter({ has: toggle });
      await header.evaluate((pane) => pane.setAttribute("data-tooltip-scroll-pane", ""));
      await page.addStyleTag({
        content: `
          [data-tooltip-scroll-pane] {
            position: relative;
            display: block;
            flex: none;
            overflow: auto;
            width: 240px;
            height: 120px;
            padding: 0;
          }
          [data-tooltip-scroll-pane] > div {
            position: relative;
            width: auto;
            margin-inline-start: 160px;
            height: 120px;
            padding: 0;
          }
          [data-tooltip-scroll-pane] > button,
          [data-tooltip-scroll-pane] > div > :not(:has([data-testid="test-result-steps-subtree-toggle"])) {
            display: none;
          }
        `,
      });
    }

    const position = await toggle.evaluateHandle((button, tooltipText) => {
      const pane = button.closest("[data-tooltip-scroll-pane]");
      const read = () => {
        const { x, y } = button.getBoundingClientRect();
        return {
          x,
          y,
          clientWidth: pane?.clientWidth,
          clientHeight: pane?.clientHeight,
          scrollWidth: pane?.scrollWidth,
          scrollHeight: pane?.scrollHeight,
        };
      };
      const sample = { before: read(), atTooltipMount: undefined as ReturnType<typeof read> | undefined };
      // Sample the first layout with the tooltip, before asynchronous positioning can move it.
      const observer = new MutationObserver((records) => {
        const tooltipMounted = records.some(({ addedNodes }) =>
          Array.from(addedNodes).some((node) => node.textContent === tooltipText),
        );
        if (tooltipMounted) {
          sample.atTooltipMount = read();
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return sample;
    }, label);

    await toggle.hover();
    const tooltip = page.getByText(label, { exact: true });
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toBeInViewport();

    const { before, atTooltipMount } = await position.jsonValue();
    expect(atTooltipMount).toEqual(before);

    await toggle.click();
    await expect(testResultPage.getStepByName("level 1").locator).toHaveCount(1);
  });
}

test("should cycle body subtree toggle state like categories", async () => {
  const level1Step = testResultPage.getStepByName("level 1");
  const level2Step = level1Step.getSubstepByName("level 2");
  const level3Step = level2Step.getSubstepByName("level 3");

  await expect(level1Step.locator).toHaveCount(0);

  await testResultPage.toggleStepsSubtree();
  await expect(level1Step.locator).toHaveCount(1);
  await expect(level2Step.locator).toHaveCount(0);

  await testResultPage.toggleStepsSubtree();
  await expect(level2Step.locator).toHaveCount(1);
  await expect(level3Step.locator).toHaveCount(1);

  await testResultPage.toggleStepsSubtree();
  await expect(level1Step.locator).toHaveCount(1);
  await expect(level2Step.locator).toHaveCount(0);

  await testResultPage.toggleStepsSubtree();
  await expect(level1Step.locator).toHaveCount(0);
  await expect(level2Step.locator).toHaveCount(0);
  await expect(level3Step.locator).toHaveCount(0);
});

test("should cycle step subtree toggle state like categories", async () => {
  const level1Step = testResultPage.getStepByName("level 1");
  const level2Step = level1Step.getSubstepByName("level 2");
  const level3Step = level2Step.getSubstepByName("level 3");

  await testResultPage.toggleStepsSubtree();
  await expect(level1Step.locator).toHaveCount(1);

  await level1Step.toggleSubtree();
  await expect(level2Step.locator).toHaveCount(1);
  await expect(level3Step.locator).toHaveCount(0);

  await level1Step.toggleSubtree();
  await expect(level2Step.locator).toHaveCount(1);
  await expect(level3Step.locator).toHaveCount(1);

  await level1Step.toggleSubtree();
  await expect(level2Step.locator).toHaveCount(1);
  await expect(level3Step.locator).toHaveCount(0);

  await level1Step.toggleSubtree();
  await expect(level2Step.locator).toHaveCount(0);
  await expect(level3Step.locator).toHaveCount(0);
});
