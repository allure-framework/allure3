import { Stage, Status, label } from "allure-js-commons";

import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { expect, test } from "../../playwright.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

const now = Date.now();

test.beforeEach(async ({ page, browserName }) => {
  await label("env", browserName);

  treePage = new TreePage(page);
  testResultPage = new TestResultPage(page);

  bootstrap = await bootstrapReport(
    {
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
      },
      testResults: [
        {
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
