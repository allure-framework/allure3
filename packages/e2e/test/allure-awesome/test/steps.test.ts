import { Stage, Status, label } from "allure-js-commons";
import { TestResultPage, TreePage } from "../../pageObjects/index.js";
import { expect, test } from "../../playwright.js";
import { type ReportBootstrap, bootstrapReport } from "../utils/index.js";

let bootstrap: ReportBootstrap;
let treePage: TreePage;
let testResultPage: TestResultPage;

const now = Date.now();
const fixtures = {
  testResults: [
    {
      name: "0 sample passed test",
      fullName: "foo",
      historyId: "foo",
      testCaseId: "foo",
      status: Status.FAILED,
      stage: Stage.FINISHED,
      start: now,
      stop: now + 1000,
      steps: [
        {
          type: "step",
          name: "level 1 step with bubbled error",
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now + 100,
          stop: now + 200,
          statusDetails: { message: "Lorem ipsum", trace: "dolor sit amet" },
          attachments: [],
          parameters: [],
          steps: [
            {
              type: "step",
              name: "level 2 step with bubbled error",
              status: Status.FAILED,
              stage: Stage.FINISHED,
              start: now + 110,
              stop: now + 190,
              statusDetails: { message: "Lorem ipsum", trace: "dolor sit amet" },
              attachments: [],
              parameters: [],
              steps: [
                {
                  type: "step",
                  name: "level 3 step with bubbled error",
                  status: Status.FAILED,
                  stage: Stage.FINISHED,
                  start: now + 120,
                  stop: now + 180,
                  statusDetails: { message: "Lorem ipsum", trace: "dolor sit amet" },
                  attachments: [],
                  parameters: [],
                  steps: [],
                },
              ],
            },
          ],
        },
        {
          type: "step",
          name: "level 1 step with unique error",
          status: Status.FAILED,
          stage: Stage.FINISHED,
          start: now + 300,
          stop: now + 400,
          statusDetails: { message: "Lorem ipsum", trace: "dolor sit amet" },
          attachments: [],
          parameters: [],
          steps: [
            {
              type: "step",
              name: "level 2 step with unique error",
              status: Status.FAILED,
              stage: Stage.FINISHED,
              start: now + 310,
              stop: now + 390,
              statusDetails: { message: "consectetur adipiscing elit", trace: "sed do eiusmod tempor" },
              attachments: [],
              parameters: [],
              steps: [
                {
                  type: "step",
                  name: "level 3 step with unique error",
                  status: Status.FAILED,
                  stage: Stage.FINISHED,
                  start: now + 320,
                  stop: now + 380,
                  statusDetails: { message: "incididunt ut labore", trace: "et dolore magna aliqua" },
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
};

test.describe("Steps in Allure Awesome", () => {
  test.beforeEach(async ({ page, browserName }) => {
    await label("env", browserName);

    treePage = new TreePage(page);
    testResultPage = new TestResultPage(page);

    bootstrap = await bootstrapReport({
      reportConfig: {
        name: "Sample allure report",
        appendHistory: false,
        knownIssuesPath: undefined,
      },
      testResults: fixtures.testResults,
    });

    await page.goto(bootstrap.url);
    await treePage.clickNthLeaf(0);
  });

  test(
    "the same error is only rendered at the leaf level",
    { annotation: [{ type: "issue", description: "201" }] },
    async () => {
      const level1Step = testResultPage.getStepByName("level 1 step with bubbled error");
      const level2Step = level1Step.getSubstepByName("level 2 step with bubbled error");
      const level3Step = level2Step.getSubstepByName("level 3 step with bubbled error");

      await level3Step.toggleDetails();

      await level1Step.attachScreenshot("Steps.png");

      expect(await level1Step.hasDetails()).toBeFalsy();
      expect(await level2Step.hasDetails()).toBeFalsy();
      await expect(level3Step).toHaveDetails("Lorem ipsum", "dolor sit amet");
    },
  );

  test("unique errors are always rendered", async () => {
    const level1Step = testResultPage.getStepByName("level 1 step with unique error");
    const level2Step = level1Step.getSubstepByName("level 2 step with unique error");
    const level3Step = level2Step.getSubstepByName("level 3 step with unique error");

    await level1Step.toggleDetails();
    await level2Step.toggleDetails();
    await level3Step.toggleDetails();

    await level1Step.attachScreenshot("Steps.png");

    await expect(level1Step).toHaveDetails("Lorem ipsum", "dolor sit amet");
    await expect(level2Step).toHaveDetails("consectetur adipiscing elit", "sed do eiusmod tempor");
    await expect(level3Step).toHaveDetails("incididunt ut labore", "et dolore magna aliqua");
  });
});
